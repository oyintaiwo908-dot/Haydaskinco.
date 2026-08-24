import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  generateOrderReference,
  initializeTransaction,
  isPaystackConfigured,
} from "@/lib/paystack"
import {
  calculateUnitPrice,
  getProductMoq,
  normalizePriceTiers,
} from "@/lib/products"
import { bareDealId, dealSalePrice, isDealCartId } from "@/lib/deals"
import type { CheckoutItem } from "@/lib/supabase/orders"

type Body = {
  items: CheckoutItem[]
  shipping: {
    firstName: string
    lastName: string
    email: string
    phone: string
    address: string
    apartment?: string
    city: string
    state: string
    zip: string
    country: string
    shippingMethod: "standard" | "express"
  }
  paymentMethod: string
  /** @deprecated use promoCodes */
  promoCode?: string | null
  promoCodes?: string[] | null
}

type PricedLine = {
  productId: string
  name: string
  image: string
  category: string
  price: number
  quantity: number
}

/** Where Paystack should send the customer after payment. */
function resolveCheckoutOrigin(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")
  const origin = request.headers.get("origin")
  if (origin && /^https?:\/\//i.test(origin)) {
    return origin.replace(/\/$/, "")
  }
  const referer = request.headers.get("referer")
  if (referer) {
    try {
      return new URL(referer).origin
    } catch {
      /* ignore */
    }
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const proto = request.headers.get("x-forwarded-proto") ?? "http"
  if (host) return `${proto}://${host}`.replace(/\/$/, "")
  return fromEnv ?? "http://localhost:3000"
}

function allowedSkuPrices(
  basePrice: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variants: any,
): Set<number> {
  const allowed = new Set<number>([Math.round(basePrice)])
  if (!Array.isArray(variants)) return allowed
  for (const v of variants) {
    const p = Math.round(Number(v?.price ?? v?.listPrice ?? NaN))
    if (Number.isFinite(p) && p > 0) allowed.add(p)
  }
  return allowed
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    const items = body.items ?? []
    const shipping = body.shipping

    if (!items.length) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 })
    }
    if (!shipping?.email || !shipping?.address || !shipping?.city) {
      return NextResponse.json({ error: "Incomplete shipping details." }, { status: 400 })
    }

    const admin = createAdminClient()
    const supabase = admin ?? (await createClient())
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 })
    }

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

    const [productsRes, dealsRes] = await Promise.all([
      productIds.length
        ? supabase
            .from("products")
            .select(
              "id, name, price, discount_pct, price_tiers, moq, stock, is_published, image_url, category, categories, variants",
            )
            .in("id", productIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      dealIds.length
        ? supabase
            .from("deals")
            .select("id, title, image_url, original_price, discount_pct, price, items, is_active, brand_name")
            .in("id", dealIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ])

    const productsById = new Map(
      (productsRes.data ?? []).map(r => [String(r.id), r as Record<string, unknown>]),
    )
    const dealsById = new Map(
      (dealsRes.data ?? []).map(r => [String(r.id), r as Record<string, unknown>]),
    )

    const problems: string[] = []
    const pricedLines: PricedLine[] = []

    for (const item of items) {
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 0))
      if (!item.productId || qty < 1) {
        problems.push("Invalid cart line")
        continue
      }

      if (isDealCartId(item.productId)) {
        const deal = dealsById.get(bareDealId(item.productId))
        if (!deal || deal.is_active === false) {
          problems.push(`${item.name || "Deal"} is no longer available`)
          continue
        }
        const originalPrice =
          Number(deal.original_price) ||
          (Array.isArray(deal.items)
            ? (deal.items as { price?: number }[]).reduce((s, i) => s + Number(i.price || 0), 0)
            : 0)
        const discountPct = Math.min(100, Math.max(0, Number(deal.discount_pct ?? 0)))
        const salePrice = dealSalePrice({
          originalPrice,
          discountPct,
          salePrice: Number(deal.price) || originalPrice,
        })
        pricedLines.push({
          productId: item.productId,
          name: String(deal.title || item.name),
          image: String(deal.image_url || item.image || "/product-bundle.png"),
          category: "Deal",
          price: salePrice,
          quantity: qty,
        })
        continue
      }

      const row = productsById.get(item.productId)
      if (!row || row.is_published === false) {
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
      if (qty > stock) {
        problems.push(`${row.name} only has ${stock} left (you requested ${qty})`)
        continue
      }

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
        image: String(row.image_url || item.image || "/placeholder.svg"),
        category,
        price: unit,
        quantity: qty,
      })
    }

    if (problems.length) {
      return NextResponse.json(
        { error: problems.join(". ") + ".", stockIssues: problems },
        { status: 409 },
      )
    }
    if (!pricedLines.length) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 })
    }

    const subtotal = pricedLines.reduce((s, i) => s + i.price * i.quantity, 0)
    const shippingCost = shipping.shippingMethod === "express" ? 3000 : 0
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
        if (
          user.email &&
          user.email.toLowerCase() === shipping.email.trim().toLowerCase()
        ) {
          userId = user.id
        }
      }
    }

    const requestedCodes = Array.from(
      new Set(
        [
          ...(Array.isArray(body.promoCodes) ? body.promoCodes : []),
          body.promoCode ?? "",
        ]
          .map(c => String(c ?? "").trim().toUpperCase())
          .filter(Boolean),
      ),
    )

    for (const code of requestedCodes) {
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

      if (allowed && code.startsWith("RWD-")) {
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
      guest_email: shipping.email.trim().toLowerCase(),
      items: pricedLines,
      shipping_address: {
        firstName: shipping.firstName,
        lastName: shipping.lastName,
        email: shipping.email,
        phone: shipping.phone,
        address: shipping.address,
        apartment: shipping.apartment ?? "",
        city: shipping.city,
        state: shipping.state,
        zip: shipping.zip,
        country: shipping.country || "Nigeria",
      },
      shipping_method: shipping.shippingMethod,
      shipping_cost: shippingCost,
      subtotal,
      tax,
      discount,
      promo_code: appliedCodes[0] ?? null,
      applied_promo_codes: appliedCodes,
      total,
      status: "pending",
      payment_status: "unpaid",
      payment_method: body.paymentMethod ?? "card",
    }

    const { data: inserted, error: insertError } = await supabase
      .from("orders")
      .insert(orderRow)
      .select("id, reference")
      .single()

    if (insertError || !inserted) {
      console.error("[orders] insert:", insertError?.message)
      return NextResponse.json(
        { error: insertError?.message ?? "Could not create order." },
        { status: 500 },
      )
    }

    // Prefer the browser that started checkout (localhost vs production),
    // not a stale NEXT_PUBLIC_SITE_URL — wrong host breaks pay → verify → cart clear.
    const siteUrl = resolveCheckoutOrigin(request)
    const callbackUrl = `${siteUrl}/checkout/callback`

    // Mock / offline path — no Paystack secret
    if (!isPaystackConfigured()) {
      return NextResponse.json({
        mock: true,
        orderId: inserted.id,
        reference,
        authorization_url: `${siteUrl}/checkout/callback?reference=${encodeURIComponent(reference)}&mock=1`,
        total,
      })
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
    console.error("[orders] POST:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed." },
      { status: 500 },
    )
  }
}
