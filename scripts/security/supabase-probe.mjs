#!/usr/bin/env node
/**
 * Probes the Supabase REST API the way an attacker with the public anon key
 * (or a normal customer account) would. LOCAL SUPABASE ONLY: it creates users,
 * calls RPCs that move stock and points, and refuses to run against any
 * non-local URL.
 *
 *   supabase start            # in a scratch copy with supabase/migrations
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/security/supabase-probe.mjs
 *
 * Exit code 0 = every attack was blocked; 1 = at least one succeeded.
 */

const url = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "")
const anon = process.env.SUPABASE_ANON_KEY ?? ""
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

const host = (() => {
  try {
    return new URL(url).hostname
  } catch {
    return ""
  }
})()
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  console.error("Refusing to run: SUPABASE_URL must point at a local Supabase (127.0.0.1/localhost).")
  process.exit(2)
}
if (!anon || !service) {
  console.error("Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (local demo keys from `supabase status`).")
  process.exit(2)
}

const results = []
function record(name, blocked, detail) {
  results.push({ name, blocked, detail })
  console.log(`${blocked ? "BLOCKED " : "EXPLOIT "} ${name}${detail ? `  (${detail})` : ""}`)
}

async function rest(path, { key = anon, token, method = "GET", body, prefer } = {}) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token ?? key}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { status: res.status, json }
}

const asService = (path, opts = {}) => rest(path, { ...opts, key: service })

async function createUser(email, password) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "Probe User" } }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`create user failed: ${res.status} ${JSON.stringify(json)}`)
  return json.id
}

async function signIn(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`sign in failed: ${res.status}`)
  return json.access_token
}

async function pointsOf(userId) {
  const { json } = await asService(`/rest/v1/points_ledger?user_id=eq.${userId}&select=delta`)
  return Array.isArray(json) ? json.reduce((s, r) => s + r.delta, 0) : NaN
}

async function stockOf(productId) {
  const { json } = await asService(`/rest/v1/products?id=eq.${productId}&select=stock`)
  return Array.isArray(json) && json[0] ? json[0].stock : NaN
}

const stamp = Date.now()
const password = `Probe-${stamp}-pw!`
const email = `probe-${stamp}@example.test`
const productId = `probe-product-${stamp}`

// Fixtures (service role)
const userId = await createUser(email, password)
await asService("/rest/v1/products", {
  method: "POST",
  body: { id: productId, name: "Probe product", price: 1000, stock: 5, is_published: true },
  prefer: "return=minimal",
})
await asService("/rest/v1/promo_codes", {
  method: "POST",
  body: { code: `PROBE-PRIVATE-${stamp}`, discount_pct: 50, is_active: true },
  prefer: "return=minimal",
})

// 1. Anonymous points mint through award_order_points(p_order public.orders)
{
  const before = await pointsOf(userId)
  const r = await rest("/rest/v1/rpc/award_order_points", {
    method: "POST",
    body: { p_order: { id: null, user_id: userId, total: 100_000_000, reference: "PROBE" } },
  })
  const after = await pointsOf(userId)
  record(
    "anon award_order_points mints points for any user",
    after === before,
    `HTTP ${r.status}, points ${before} -> ${after}`,
  )
}

// 2. Anonymous stock inflation / sabotage
{
  const before = await stockOf(productId)
  const inc = await rest("/rest/v1/rpc/increment_product_stock", {
    method: "POST",
    body: { p_items: [{ productId, quantity: 1000 }] },
  })
  const mid = await stockOf(productId)
  record("anon increment_product_stock inflates stock", mid === before, `HTTP ${inc.status}, stock ${before} -> ${mid}`)

  const dec = await rest("/rest/v1/rpc/decrement_product_stock", {
    method: "POST",
    body: { p_items: [{ productId, quantity: mid }] },
  })
  const after = await stockOf(productId)
  record("anon decrement_product_stock zeroes stock", after === mid, `HTTP ${dec.status}, stock ${mid} -> ${after}`)
}

// 3. Anonymous promo code listing
{
  const r = await rest("/rest/v1/promo_codes?select=code")
  const n = Array.isArray(r.json) ? r.json.length : 0
  record("anon can list promo codes", n === 0, `HTTP ${r.status}, ${n} codes visible`)
}

// 4. Customer points farming
const token = await signIn(email, password)
{
  await rest(`/rest/v1/profiles?id=eq.${userId}`, {
    token,
    method: "PATCH",
    body: { full_name: "Probe User", phone: "08000000000" },
  })
  await rest("/rest/v1/rpc/claim_profile_bonus", { token, method: "POST", body: {} })
  const afterFirst = await pointsOf(userId)
  await rest(`/rest/v1/profiles?id=eq.${userId}`, {
    token,
    method: "PATCH",
    body: { profile_bonus_claimed: false },
  })
  await rest("/rest/v1/rpc/claim_profile_bonus", { token, method: "POST", body: {} })
  const afterSecond = await pointsOf(userId)
  record(
    "customer resets profile_bonus_claimed and re-claims +100",
    afterSecond === afterFirst,
    `points ${afterFirst} -> ${afterSecond}`,
  )
}
{
  const args = { p_product_id: productId, p_rating: 5, p_title: "t", p_body: "b", p_author_name: "" }
  await rest("/rest/v1/rpc/submit_review", { token, method: "POST", body: args })
  const first = await pointsOf(userId)
  await rest(`/rest/v1/reviews?user_id=eq.${userId}&product_id=eq.${productId}`, { token, method: "DELETE" })
  await rest("/rest/v1/rpc/submit_review", { token, method: "POST", body: args })
  const second = await pointsOf(userId)
  record("customer deletes + re-posts a review for +50 again", second === first, `points ${first} -> ${second}`)

  const fake = await rest("/rest/v1/rpc/submit_review", {
    token,
    method: "POST",
    body: { ...args, p_product_id: `not-a-product-${stamp}` },
  })
  const third = await pointsOf(userId)
  record("customer reviews a non-existent product for +50", third === second, `HTTP ${fake.status}, points ${second} -> ${third}`)
}

const exploited = results.filter(r => !r.blocked)
console.log(`\n${results.length - exploited.length}/${results.length} attacks blocked`)
process.exit(exploited.length ? 1 : 0)
