import { SITE_HOLDING, holdingResponse } from "@/lib/holding"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  generateOrderReference,
  initializeTransaction,
  isPaystackConfigured,
  allowMockCheckout,
} from "@/lib/paystack"
import {
  calculateUnitPrice,
  getProductMoq,
  normalizePriceTiers,
} from "@/lib/products"
import { bareDealId, dealSalePrice, isDealCartId } from "@/lib/deals"
import { type CheckoutItem } from "@/lib/supabase/orders"
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { getSiteUrl } from "@/lib/site"
import { isMissingArchiveColumn, markArchiveColumnMissing } from "@/lib/supabase/archive-column"
import {
  EMAIL_RE,
  ValidationError,
  errorResponse,
  jsonError,
  readJsonObject,
  stringField,
} from "@/lib/api-guard"

type Shipping = {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  apartment: string
  city: string
  state: string
  zip: string
  country: string
  shippingMethod: "standard" | "express"
}

type Body = {
  items: CheckoutItem[]
  shipping: Shipping
  paymentMethod: PaymentMethod
  promoCodes: string[]
}

const MAX_LINES = 50
const MAX_QTY = 999
const PAYMENT_METHODS = ["card", "bank_transfer", "ussd", "mobile_money"] as const
type PaymentMethod = (typeof PAYMENT_METHODS)[number]
const MAX_PROMO_CODES = 2

const PROMO_STACKING_ERROR =
  "Only one promo code and one rewards code can be used per order. Remove the extra code and try again."

function isRewardCode(code: string) {
  return code.startsWith("RWD-")
}

/** Validate and normalise the checkout payload. Prices from the client are ignored. */
function parseBody(raw: Record<string, unknown>): Body {
  if (!Array.isArray(raw.items)) throw new ValidationError("Cart is empty.")
  if (raw.items.length === 0) throw new ValidationError("Cart is empty.")
  if (raw.items.length > MAX_LINES) {
    throw new ValidationError(`A single order can hold at most ${MAX_LINES} different items.`)
  }

  const items: CheckoutItem[] = raw.items.map(entry => {
    if (!entry || typeof entry !== "object") throw new ValidationError("Invalid cart line.")
    const line = entry as Record<string, unknown>
    const productId = stringField(line, "productId", 160, "Product id")
    if (!productId) throw new ValidationError("Invalid cart line.")
    const quantity = Math.floor(Number(line.quantity))
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QTY) {
      throw new ValidationError(`Quantity must be between 1 and ${MAX_QTY}.`)
    }
    const skuPrice = line.skuPrice == null ? undefined : Number(line.skuPrice)
    return {
      productId,
      name: stringField(line, "name", 200, "Item name"),
      image: stringField(line, "image", 500, "Item image"),
      category: stringField(line, "category", 120, "Item category"),
      price: 0,
      quantity,
      skuPrice: Number.isFinite(skuPrice) ? skuPrice : undefined,
    }
  })

  const s = raw.shipping
  if (!s || typeof s !== "object" || Array.isArray(s)) {
    throw new ValidationError("Incomplete shipping details.")
  }
  const ship = s as Record<string, unknown>
  // Still accepted (and validated) so older clients keep working, but it no longer affects the
  // price: delivery is quoted and paid separately after the order.
  const method = ship.shippingMethod ?? "standard"
  if (method !== "standard" && method !== "express") {
    throw new ValidationError("Choose a valid shipping method.")
  }
  const shipping: Shipping = {
    firstName: stringField(ship, "firstName", 80, "First name"),
    lastName: stringField(ship, "lastName", 80, "Last name"),
    email: stringField(ship, "email", 254, "Email").toLowerCase(),
    phone: stringField(ship, "phone", 40, "Phone"),
    address: stringField(ship, "address", 200, "Address"),
    apartment: stringField(ship, "apartment", 120, "Apartment"),
    city: stringField(ship, "city", 80, "City"),
    state: stringField(ship, "state", 80, "State"),
    zip: stringField(ship, "zip", 20, "Postal code"),
    country: stringField(ship, "country", 60, "Country") || "Nigeria",
    shippingMethod: method,
  }
  if (!shipping.email || !shipping.address || !shipping.city) {
    throw new ValidationError("Incomplete shipping details.")
  }
  if (!EMAIL_RE.test(shipping.email)) throw new ValidationError("Enter a valid email address.")

  const pm = raw.paymentMethod ?? "card"
  if (typeof pm !== "string" || !(PAYMENT_METHODS as readonly string[]).includes(pm)) {
    throw new ValidationError("Choose a valid payment method.")
  }

  const rawCodes = [
    ...(Array.isArray(raw.promoCodes) ? raw.promoCodes : []),
    // Legacy single-code field
    raw.promoCode ?? "",
  ]
  if (rawCodes.length > 10) throw new ValidationError(PROMO_STACKING_ERROR)
  const promoCodes = Array.from(
    new Set(
      rawCodes
        .map(c => (typeof c === "string" ? c : "").trim().toUpperCase())
        .filter(c => c.length > 0 && c.length <= 40),
    ),
  )
  const rewardCount = promoCodes.filter(isRewardCode).length
  const regularCount = promoCodes.length - rewardCount
  if (promoCodes.length > MAX_PROMO_CODES || rewardCount > 1 || regularCount > 1) {
    throw new ValidationError(PROMO_STACKING_ERROR)
  }

  return { items, shipping, paymentMethod: pm as PaymentMethod, promoCodes }
}

type PricedLine = {
  productId: string
  name: string
  image: string
  category: string
  price: number
  quantity: number
}

function isLocalDevHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
}

/** Where Paystack should send the customer after payment. */
function resolveCheckoutOrigin(request: Request): string {
  const site = getSiteUrl().replace(/\/$/, "")
  const candidates: string[] = []

  const origin = request.headers.get("origin")
  if (origin && /^https?:\/\//i.test(origin)) {
    candidates.push(origin.replace(/\/$/, ""))
  }
  const referer = request.headers.get("referer")
  if (referer) {
    try {
      candidates.push(new URL(referer).origin)
    } catch {
      /* ignore */
    }
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const proto = request.headers.get("x-forwarded-proto") ?? "http"
  if (host) candidates.push(`${proto}://${host}`.replace(/\/$/, ""))

  const allowed = new Set<string>([site])
  try {
    const siteHost = new URL(site).hostname
    if (isLocalDevHost(siteHost) || process.env.NODE_ENV !== "production") {
      allowed.add("http://localhost:3000")
      allowed.add("http://127.0.0.1:3000")
    }
  } catch {
    /* ignore */
  }

  for (const c of candidates) {
    try {
      const u = new URL(c)
      if (allowed.has(u.origin)) return u.origin
      // Same host as configured site (http/https drift)
      if (u.hostname === new URL(site).hostname) return u.origin
    } catch {
      /* ignore */
    }
  }

  return site
}

function allowedSkuPrices(basePrice: number, variants: unknown): Set<number> {
  const allowed = new Set<number>([Math.round(basePrice)])
  if (!Array.isArray(variants)) return allowed
  for (const entry of variants) {
    const v = (entry ?? {}) as { price?: unknown; listPrice?: unknown }
    const p = Math.round(Number(v.price ?? v.listPrice ?? NaN))
    if (Number.isFinite(p) && p > 0) allowed.add(p)
  }
  return allowed
}

export async function POST(request: Request) {
  // Holding page until launch: no orders or form posts from stale tabs (lib/holding.ts).
  if (SITE_HOLDING) return holdingResponse()
  try {
    const ip = clientIp(request)
    const limited = await rateLimit(`orders-create:${ip}`, 10, 60_000)
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec)

    const body = parseBody(await readJsonObject(request, 64_000))
    const items = body.items
    const shipping = body.shipping

    const admin = createAdminClient()
    // Order insert policy is service-role only (migration 027)
    if (!admin) {
      console.error("[orders] SUPABASE_SERVICE_ROLE_KEY is not configured")
      return jsonError("Checkout is temporarily unavailable.", 503)
    }
    const supabase = admin

    const productIds = [
      ...new Set(
        items
          .map(i => i.productId)
          .filter((id): id is string => Boolean(id) && !isDealCartId(String(id))),
      ),
    ]
    const dealIds = [
      ...new Set(
        items
          .map(i => i.productId)
          .filter((id): id is string => Boolean(id) && isDealCartId(String(id)))
          .map(id => bareDealId(String(id))),
      ),
    ]

    const dealsRes = dealIds.length
      ? await supabase
          .from("deals")
          .select("id, title, image_url, original_price, discount_pct, price, items, is_active, brand_name")
          .in("id", dealIds)
      : { data: [] as Record<string, unknown>[] }

    const dealsById = new Map(
      (dealsRes.data ?? []).map(r => [String(r.id), r as Record<string, unknown>]),
    )

    const componentIds: string[] = []
    for (const deal of dealsById.values()) {
      if (!Array.isArray(deal.items)) continue
      for (const di of deal.items as { productId?: string }[]) {
        if (di.productId) componentIds.push(String(di.productId))
      }
    }

    const allProductIds = [...new Set([...productIds, ...componentIds])]
    const productColumns =
      "id, name, price, discount_pct, price_tiers, moq, stock, is_published, image_url, category, categories, variants"
    let productsRes = allProductIds.length
      ? await supabase
          .from("products")
          .select(`${productColumns}, is_archived`)
          .in("id", allProductIds)
      : { data: [] as Record<string, unknown>[], error: null }
    if (productsRes.error && isMissingArchiveColumn(productsRes.error.message)) {
      markArchiveColumnMissing()
      productsRes = await supabase
        .from("products")
        .select(productColumns)
        .in("id", allProductIds)
    }

    const productsById = new Map(
      (productsRes.data ?? []).map(r => [String(r.id), r as Record<string, unknown>]),
    )

    const problems: string[] = []
    const pricedLines: PricedLine[] = []
    const stockDemand = new Map<string, { need: number; name: string }>()

    function addDemand(pid: string, need: number, name: string) {
      const cur = stockDemand.get(pid)
      if (cur) cur.need += need
      else stockDemand.set(pid, { need, name })
    }

    for (const item of items) {
      const qty = item.quantity

      if (isDealCartId(item.productId)) {
        const deal = dealsById.get(bareDealId(item.productId))
        if (!deal || deal.is_active === false) {
          problems.push(`${item.name || "Deal"} is no longer available`)
          continue
        }
        const dealItems = Array.isArray(deal.items)
          ? (deal.items as { productId?: string; name?: string; qty?: number; price?: number }[])
          : []
        if (!dealItems.length) {
          problems.push(`${String(deal.title || "Deal")} has no products`)
          continue
        }
        for (const di of dealItems) {
          const cid = di.productId ? String(di.productId) : ""
          if (!cid) continue
          const cqty = Math.max(1, Math.floor(Number(di.qty) || 1)) * qty
          const prow = productsById.get(cid)
          if (!prow || prow.is_published === false || prow.is_archived === true) {
            problems.push(`${di.name || cid} in ${String(deal.title || "deal")} is unavailable`)
            continue
          }
          addDemand(cid, cqty, String(prow.name || di.name || cid))
        }
        const originalPrice =
          Number(deal.original_price) ||
          dealItems.reduce((s, i) => s + Number(i.price || 0), 0)
        const discountPct = Math.min(100, Math.max(0, Number(deal.discount_pct ?? 0)))
        const salePrice = dealSalePrice({
          originalPrice,
          discountPct,
          salePrice: Number(deal.price) || originalPrice,
        })
        pricedLines.push({
          productId: item.productId,
          name: String(deal.title || item.name),
          image: String(deal.image_url || "/placeholder.svg"),
          category: "Deal",
          price: salePrice,
          quantity: qty,
        })
        continue
      }

      const row = productsById.get(item.productId)
      if (!row || row.is_published === false || row.is_archived === true) {
        problems.push(`${item.name || item.productId} is unavailable`)
        continue
      }
      const stock = Number(row.stock) || 0
      if (stock <= 0) {
        problems.push(`${row.name || item.name} is out of stock`)
        continue
      }
      const moq = getProductMoq({ moq: Number(row.moq) || 1 })
      if (qty < moq) {
        problems.push(`${row.name} requires a minimum of ${moq}`)
        continue
      }
      addDemand(item.productId, qty, String(row.name || item.name))

      const basePrice = Math.round(Number(row.price) || 0)
      const discountPct = Math.min(100, Math.max(0, Number(row.discount_pct) || 0))
      const tiers = normalizePriceTiers(row.price_tiers as never, basePrice)
      const allowed = allowedSkuPrices(basePrice, row.variants)
      const requestedSku = item.skuPrice != null ? Math.round(Number(item.skuPrice)) : basePrice
      const skuPrice = allowed.has(requestedSku) ? requestedSku : basePrice

      const unit = calculateUnitPrice({
        basePrice,
        skuPrice,
        quantity: qty,
        priceTiers: tiers,
        discountPct,
      })

      const cats = Array.isArray(row.categories)
        ? (row.categories as string[]).filter(Boolean)
        : []
      const category = cats[0] || String(row.category || item.category || "")

      pricedLines.push({
        productId: item.productId,
        name: String(row.name || item.name),
        image: String(row.image_url || "/placeholder.svg"),
        category,
        price: unit,
        quantity: qty,
      })
    }

    for (const [pid, { need, name }] of stockDemand) {
      const row = productsById.get(pid)
      const available = Number(row?.stock) || 0
      if (need > available) {
        problems.push(`${name} only has ${available} left (you need ${need})`)
      }
    }

    if (problems.length) {
      return NextResponse.json(
        { error: problems.join(". ") + ".", stockIssues: problems },
        { status: 409 },
      )
    }
    if (!pricedLines.length) {
      return jsonError("Cart is empty.", 400)
    }

    const subtotal = pricedLines.reduce((s, i) => s + i.price * i.quantity, 0)
    // No delivery fee at checkout, whatever the client sends (owner decision): delivery is quoted
    // and paid separately after the order.
    const shippingCost = 0
    const tax = Math.round(subtotal * 0.075)

    let discount = 0
    const appliedCodes: string[] = []

    // Attach customer session only — never the admin cookie jar.
    // Also require shipping email to match the signed-in customer email for user_id.
    const browserish = await createClient("customer")
    let userId: string | null = null
    let authUserId: string | null = null
    if (browserish) {
      const { data: { user } } = await browserish.auth.getUser()
      if (user?.id) {
        authUserId = user.id
        if (user.email && user.email.toLowerCase() === shipping.email) {
          userId = user.id
        }
      }
    }

    // parseBody already enforced: at most one regular code + one RWD- code.
    for (const code of body.promoCodes) {
      const { data: promo } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle()

      if (!promo) continue

      const expired = promo.expires_at && new Date(promo.expires_at) < new Date()
      const exhausted = promo.max_uses != null && promo.used_count >= promo.max_uses
      let allowed = !expired && !exhausted

      if (allowed && isRewardCode(code)) {
        if (!authUserId) {
          allowed = false
        } else {
          const { data: redemption } = await supabase
            .from("reward_redemptions")
            .select("id")
            .eq("promo_code", code)
            .eq("user_id", authUserId)
            .maybeSingle()
          allowed = Boolean(redemption)
        }
      }

      if (!allowed) continue

      appliedCodes.push(promo.code)
      if (promo.discount_ngn != null && Number(promo.discount_ngn) > 0) {
        discount += Number(promo.discount_ngn)
      } else if (promo.discount_pct != null) {
        discount += Math.round(subtotal * (Number(promo.discount_pct) / 100))
      }
    }

    discount = Math.min(subtotal, discount)

    const total = Math.max(0, subtotal - discount + shippingCost + tax)
    const reference = generateOrderReference()

    const orderRow = {
      reference,
      user_id: userId,
      guest_email: shipping.email,
      items: pricedLines,
      shipping_address: {
        firstName: shipping.firstName,
        lastName: shipping.lastName,
        email: shipping.email,
        phone: shipping.phone,
        address: shipping.address,
        apartment: shipping.apartment,
        city: shipping.city,
        state: shipping.state,
        zip: shipping.zip,
        country: shipping.country,
      },
      shipping_method: "standard",
      shipping_cost: shippingCost,
      subtotal,
      tax,
      discount,
      promo_code: appliedCodes[0] ?? null,
      applied_promo_codes: appliedCodes,
      total,
      status: "pending",
      payment_status: "unpaid",
      payment_method: body.paymentMethod,
    }

    const { data: inserted, error: insertError } = await supabase
      .from("orders")
      .insert(orderRow)
      .select("id, reference")
      .single()

    if (insertError || !inserted) {
      console.error("[orders] insert:", insertError?.message)
      return jsonError("Could not create order. Please try again.", 500)
    }

    // Allowlist checkout return host (env site URL + local only in non-prod).
    const siteUrl = resolveCheckoutOrigin(request)
    const callbackUrl = `${siteUrl}/checkout/callback`

    // Mock / offline path — only when Paystack secret is unset (never if keys are set)
    if (allowMockCheckout()) {
      return NextResponse.json({
        mock: true,
        orderId: inserted.id,
        reference,
        authorization_url: `${siteUrl}/checkout/callback?reference=${encodeURIComponent(reference)}&mock=1`,
        total,
      })
    }

    if (!isPaystackConfigured()) {
      return jsonError("Payments are not configured.", 503)
    }

    const paystack = await initializeTransaction({
      email: shipping.email,
      amountNgn: total,
      reference,
      callbackUrl,
      metadata: {
        order_id: inserted.id,
        reference,
        custom_fields: [
          { display_name: "Order", variable_name: "order_ref", value: reference },
        ],
      },
    })

    await supabase
      .from("orders")
      .update({ paystack_access_code: paystack.access_code })
      .eq("id", inserted.id)

    return NextResponse.json({
      mock: false,
      orderId: inserted.id,
      reference: paystack.reference,
      authorization_url: paystack.authorization_url,
      access_code: paystack.access_code,
      total,
    })
  } catch (err) {
    return errorResponse("orders", err, "Checkout failed. Please try again.")
  }
}
