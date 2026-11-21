#!/usr/bin/env node
/**
 * HTTP security smoke tests for a running `next start`.
 *
 *   BASE_URL=http://localhost:3100 \
 *   PAYSTACK_TEST_SECRET=<the fake PAYSTACK_SECRET_KEY the server was started with> \
 *   node scripts/security/smoke.mjs
 *
 * Default checks never write to a database: every request is rejected before
 * any DB call (bad signature, no session, invalid body, rate limit).
 *
 * ORDER_TESTS=1 adds checkout tampering checks. They INSERT orders, so they only
 * run when the server's Supabase is local; pass the same local URL and service key:
 *   ORDER_TESTS=1 SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=...
 * Start that server WITHOUT PAYSTACK_SECRET_KEY so no request reaches Paystack.
 */
import { createHmac } from "node:crypto"

const BASE = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/$/, "")
const results = []

function check(name, pass, detail = "") {
  results.push({ name, pass })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`)
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    // Fresh client IP per request so per-IP limits do not mask other checks
    // (only meaningful against a local server; Vercel overwrites this header).
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250) + 1}`,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    redirect: "manual",
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, headers: res.headers }
}

// ── Security headers ──────────────────────────────────────────────────────────
{
  const res = await fetch(`${BASE}/`, { redirect: "manual" })
  const h = res.headers
  check("X-Frame-Options: DENY", h.get("x-frame-options") === "DENY")
  check("X-Content-Type-Options: nosniff", h.get("x-content-type-options") === "nosniff")
  check("Referrer-Policy set", Boolean(h.get("referrer-policy")))
  check("Permissions-Policy set", Boolean(h.get("permissions-policy")))
  check("Strict-Transport-Security set", Boolean(h.get("strict-transport-security")))
  const csp = h.get("content-security-policy-report-only") ?? ""
  check("CSP (report-only) has frame-ancestors 'none'", csp.includes("frame-ancestors 'none'"))
}

// ── Paystack webhook ──────────────────────────────────────────────────────────
{
  const body = JSON.stringify({ event: "charge.success", data: { reference: "HAY-FORGED-1", amount: 100 } })
  const forged = await post("/api/webhooks/paystack", body, { "x-paystack-signature": "0".repeat(128) })
  check("forged webhook signature -> 401", forged.status === 401, `got ${forged.status}`)
  const missing = await post("/api/webhooks/paystack", body)
  check("missing webhook signature -> 401", missing.status === 401, `got ${missing.status}`)

  const secret = process.env.PAYSTACK_TEST_SECRET
  if (secret) {
    const sig = createHmac("sha512", secret).update(body).digest("hex")
    const signed = await post("/api/webhooks/paystack", body, { "x-paystack-signature": sig })
    check(
      "correctly signed webhook passes the signature gate (unknown order -> no-op)",
      signed.status !== 401,
      `got ${signed.status}`,
    )
  }
}

// ── Cookie-authenticated routes without a session ────────────────────────────
for (const [path, body] of [
  ["/api/admin/orders/status", { reference: "HAY-X", status: "shipped" }],
  ["/api/email/reward", { promoCode: "RWD-ABC", discountNgn: 999999 }],
  ["/api/email/welcome", { email: "someone@example.test", name: "x" }],
  ["/api/newsletter/prefs", { newsletter: true }],
]) {
  const r = await post(path, body)
  check(`${path} without session -> 401/403`, r.status === 401 || r.status === 403, `got ${r.status}`)
  const cross = await post(path, body, { Origin: "https://evil.example" })
  check(`${path} cross-origin -> 403`, cross.status === 403, `got ${cross.status}`)
}

// ── Checkout input validation (rejected before any DB access) ────────────────
const shipping = {
  firstName: "Test",
  lastName: "Buyer",
  email: "buyer@example.test",
  phone: "08000000000",
  address: "1 Test Street",
  city: "Lagos",
  state: "Lagos",
  zip: "100001",
  country: "Nigeria",
  shippingMethod: "standard",
}
const line = { productId: "any-product", quantity: 1, name: "x", image: "", category: "", price: 1 }
{
  const many = await post("/api/orders", {
    items: Array.from({ length: 51 }, (_, i) => ({ ...line, productId: `p${i}` })),
    shipping,
    paymentMethod: "card",
  })
  check("51 cart lines -> 400", many.status === 400, `got ${many.status}`)

  const qty = await post("/api/orders", { items: [{ ...line, quantity: 100000 }], shipping, paymentMethod: "card" })
  check("quantity 100000 -> 400", qty.status === 400, `got ${qty.status}`)

  const ship = await post("/api/orders", {
    items: [line],
    shipping: { ...shipping, shippingMethod: "free-teleport" },
    paymentMethod: "card",
  })
  check("unknown shipping method -> 400", ship.status === 400, `got ${ship.status}`)

  const pm = await post("/api/orders", { items: [line], shipping, paymentMethod: "<script>" })
  check("unknown payment method -> 400", pm.status === 400, `got ${pm.status}`)

  const stack = await post("/api/orders", {
    items: [line],
    shipping,
    paymentMethod: "card",
    promoCodes: ["HAYDA10", "WELCOME15", "SKINCARE20", "WELCOME10"],
  })
  check(
    "four stacked promo codes -> 400 with a clear message",
    stack.status === 400 && /one promo code/i.test(stack.json?.error ?? ""),
    `got ${stack.status} ${stack.json?.error ?? ""}`,
  )

  const big = await post("/api/orders", "x".repeat(70_000))
  check("oversized order body -> 400", big.status === 400, `got ${big.status}`)

  const longName = await post("/api/contact", {
    name: "x".repeat(500),
    email: "a@example.test",
    message: "hi",
  })
  check("contact name over 120 chars -> 400", longName.status === 400, `got ${longName.status}`)
}

// ── Rate limiting (contact: 5/min/IP; invalid bodies never reach the DB) ─────
{
  const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`
  const statuses = []
  for (let i = 0; i < 6; i++) {
    const r = await post("/api/contact", {}, { "x-forwarded-for": ip })
    statuses.push(r.status)
  }
  check("6th contact POST in a minute -> 429", statuses[5] === 429, statuses.join(","))
}

// ── Optional: checkout tampering against a LOCAL Supabase ────────────────────
if (process.env.ORDER_TESTS === "1") {
  const sbUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "")
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  const host = (() => {
    try {
      return new URL(sbUrl).hostname
    } catch {
      return ""
    }
  })()
  if (!["127.0.0.1", "localhost"].includes(host) || !key) {
    console.error("ORDER_TESTS needs SUPABASE_URL on localhost and SUPABASE_SERVICE_ROLE_KEY. Skipping.")
    process.exitCode = 2
  } else {
    const sb = async (path, init = {}) => {
      const res = await fetch(`${sbUrl}${path}`, {
        ...init,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
          ...(init.headers ?? {}),
        },
      })
      return res.json().catch(() => null)
    }
    const stamp = Date.now()
    const pid = `smoke-product-${stamp}`
    await sb("/rest/v1/products", {
      method: "POST",
      body: JSON.stringify({ id: pid, name: "Smoke product", price: 10000, stock: 50, is_published: true }),
    })
    await sb("/rest/v1/promo_codes", {
      method: "POST",
      body: JSON.stringify({ code: `SMOKE10-${stamp}`, discount_pct: 10, is_active: true }),
    })
    const orderFor = async email =>
      (await sb(`/rest/v1/orders?guest_email=eq.${encodeURIComponent(email)}&select=subtotal,discount,total,applied_promo_codes,items`))?.[0]

    // a) client-supplied prices and SKU price are ignored
    const e1 = `tamper-${stamp}@example.test`
    await post("/api/orders", {
      items: [{ productId: pid, quantity: 2, price: 1, skuPrice: 1, name: "x", image: "", category: "" }],
      shipping: { ...shipping, email: e1 },
      paymentMethod: "card",
    })
    const o1 = await orderFor(e1)
    check(
      "tampered price/skuPrice ignored: subtotal = 2 x 10000",
      Number(o1?.subtotal) === 20000 && Number(o1?.total) === 20000 + 1500,
      `subtotal=${o1?.subtotal} total=${o1?.total}`,
    )

    // b) one valid code applies; a second regular code is rejected outright
    const e2 = `promo-${stamp}@example.test`
    await post("/api/orders", {
      items: [{ productId: pid, quantity: 1, name: "x", image: "", category: "", price: 0 }],
      shipping: { ...shipping, email: e2 },
      paymentMethod: "card",
      promoCodes: [`SMOKE10-${stamp}`],
    })
    const o2 = await orderFor(e2)
    check("single promo code applies 10%", Number(o2?.discount) === 1000, `discount=${o2?.discount}`)

    const e3 = `stack-${stamp}@example.test`
    const r3 = await post("/api/orders", {
      items: [{ productId: pid, quantity: 1, name: "x", image: "", category: "", price: 0 }],
      shipping: { ...shipping, email: e3 },
      paymentMethod: "card",
      promoCodes: [`SMOKE10-${stamp}`, "HAYDA10"],
    })
    const o3 = await orderFor(e3)
    check("two regular promo codes -> 400 and no order row", r3.status === 400 && !o3, `got ${r3.status}`)

    // c) someone else's reward code is ignored for a guest
    const e4 = `rwd-${stamp}@example.test`
    await sb("/rest/v1/promo_codes", {
      method: "POST",
      body: JSON.stringify({ code: `RWD-SMOKE${stamp}`, discount_ngn: 2000, max_uses: 1, is_active: true }),
    })
    await post("/api/orders", {
      items: [{ productId: pid, quantity: 1, name: "x", image: "", category: "", price: 0 }],
      shipping: { ...shipping, email: e4 },
      paymentMethod: "card",
      promoCodes: [`RWD-SMOKE${stamp}`],
    })
    const o4 = await orderFor(e4)
    check("unowned reward code gives no discount", Number(o4?.discount) === 0, `discount=${o4?.discount}`)

    // d) unknown product / over-stock
    const r5 = await post("/api/orders", {
      items: [{ productId: `missing-${stamp}`, quantity: 1, name: "x", image: "", category: "", price: 0 }],
      shipping: { ...shipping, email: `missing-${stamp}@example.test` },
      paymentMethod: "card",
    })
    check("unknown product -> 409", r5.status === 409, `got ${r5.status}`)
    const r6 = await post("/api/orders", {
      items: [{ productId: pid, quantity: 51, name: "x", image: "", category: "", price: 0 }],
      shipping: { ...shipping, email: `over-${stamp}@example.test` },
      paymentMethod: "card",
    })
    check("quantity above stock -> 409", r6.status === 409, `got ${r6.status}`)
  }
}

const failed = results.filter(r => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exitCode = 1
