#!/usr/bin/env node
// Scripted browse session against a production build (`next start`), to estimate how many
// requests would run a Vercel Function. Read-only: GET requests only.
//
// Usage:
//   pnpm perf:session                         # http://localhost:3123 and .next-e2e (the e2e mock build)
//   node scripts/perf/session.mjs <baseUrl> <distDir>
//
// Start a mock production server first, e.g.:
//   E2E_SKIP_BUILD=1 PORT=3123 node e2e/server.mjs      (after `pnpm test:e2e` has built .next-e2e)
//
// For each step of a home → shop → filtered shop → product → journal session (plus a few
// static pages) it requests the URL as a document and as a router prefetch (`RSC: 1`,
// `Next-Router-Prefetch: 1`). A response with `Cache-Control: private` / `no-store`, or with
// `x-nextjs-cache: MISS` / `STALE`, counts as a would-be function invocation. Target: 0–1.
//
// It also asserts proxy coverage from the built manifests: the proxy (middleware) matcher must
// match /admin and /api/admin paths and nothing else. Exit code 1 on any failure.
import fs from "node:fs"
import path from "node:path"

const base = (process.argv[2] || process.env.SESSION_BASE || "http://localhost:3123").replace(/\/$/, "")
const distDir = path.resolve(process.argv[3] || process.env.SESSION_DIST || ".next-e2e")
const MAX_INVOCATIONS = 1

// ── Proxy coverage ───────────────────────────────────────────────────────────
function proxyMatchers(dir) {
  const read = file => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, "server", file), "utf8"))
    } catch {
      return null
    }
  }
  const matchers = []
  for (const m of Object.values(read("middleware-manifest.json")?.middleware ?? {})) matchers.push(...(m.matchers ?? []))
  for (const [name, fn] of Object.entries(read("functions-config-manifest.json")?.functions ?? {})) {
    if (/middleware|proxy/.test(name)) matchers.push(...(fn.matchers ?? []))
  }
  return matchers.map(m => new RegExp(m.regexp))
}

const mustMatch = ["/admin", "/admin/login", "/admin/orders/abc", "/api/admin/orders/status"]
const mustNotMatch = [
  "/", "/shop", "/product/cerave-hydrating-cleanser", "/checkout", "/journal", "/account",
  "/api/orders", "/api/promo", "/api/newsletter", "/api/webhooks/paystack",
  "/administrator", "/api/administer", "/_next/static/chunks/app.js",
]

const failures = []
const matchers = proxyMatchers(distDir)
if (!matchers.length) failures.push(`no proxy matchers found in ${distDir}/server (is this a production build?)`)
const runsProxy = p => matchers.some(re => re.test(p))
for (const p of mustMatch) if (!runsProxy(p)) failures.push(`proxy does not cover ${p}`)
for (const p of mustNotMatch) if (runsProxy(p)) failures.push(`proxy unexpectedly covers ${p}`)
console.log(`proxy coverage: ${matchers.length} matcher(s); ${mustMatch.length} admin paths covered, ${mustNotMatch.length} other paths excluded: ${failures.length ? "FAIL" : "ok"}`)

// ── Session ──────────────────────────────────────────────────────────────────
const session = [
  "/",
  "/shop",
  "/shop?category=serums-treatment",
  "/shop?skinType=oily-skin",
  "/product/cerave-hydrating-cleanser",
  "/journal",
  "/journal/art-of-layering-skincare-ritual",
  "/brands",
  "/offers",
  "/checkout",
]
const kinds = {
  document: {},
  prefetch: { RSC: "1", "Next-Router-Prefetch": "1" },
}

let invocations = 0
const rows = []
for (const url of session) {
  for (const [kind, headers] of Object.entries(kinds)) {
    let res
    try {
      // Follow redirects: an RSC request without the `_rsc` cache-busting parameter is
      // answered with a 307 to the same URL plus `_rsc`, which the router then fetches.
      res = await fetch(base + url, { headers, redirect: "follow" })
    } catch (error) {
      console.error(`cannot reach ${base}: ${error.message}. Start a production server first (see the header of this file).`)
      process.exit(1)
    }
    await res.arrayBuffer()
    const cc = res.headers.get("cache-control") || ""
    const cache = res.headers.get("x-nextjs-cache") || "-"
    const dynamic = /private|no-store/.test(cc)
    const regen = cache === "MISS" || cache === "STALE"
    const proxy = runsProxy(new URL(base + url).pathname)
    const counted = dynamic || regen || proxy
    if (counted) invocations++
    const via = res.redirected ? " (after redirect)" : ""
    rows.push(`${kind.padEnd(8)} ${url.padEnd(40)} ${String(res.status).padEnd(4)} ${cache.padEnd(6)} ${counted ? "FUNCTION" : "cdn     "} ${cc}${via}`)
  }
}
console.log(rows.join("\n"))
console.log(`\nrequests=${rows.length} wouldBeFunctionInvocations=${invocations} (target 0–${MAX_INVOCATIONS})`)
if (invocations > MAX_INVOCATIONS) failures.push(`${invocations} would-be function invocations (max ${MAX_INVOCATIONS})`)

if (failures.length) {
  console.error("\nFAIL:\n- " + failures.join("\n- "))
  process.exit(1)
}
console.log("PASS")
