import fs from "node:fs"
import path from "node:path"
import { test, expect } from "./fixtures"

/**
 * The proxy (middleware) is a billed function on every request it matches, so the built
 * matcher must cover /admin and /api/admin only. Reads the manifests of the build under test
 * (.next-e2e, written by e2e/server.mjs). scripts/perf/session.mjs asserts the same.
 */
test("built proxy matcher covers only /admin and /api/admin", () => {
  const server = path.resolve(__dirname, "..", process.env.NEXT_DIST_DIR || ".next-e2e", "server")
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(server, file), "utf8"))
  const regexps: RegExp[] = []
  for (const m of Object.values(read("middleware-manifest.json").middleware ?? {}) as { matchers?: { regexp: string }[] }[]) {
    for (const x of m.matchers ?? []) regexps.push(new RegExp(x.regexp))
  }
  for (const [name, fn] of Object.entries(read("functions-config-manifest.json").functions ?? {}) as [string, { matchers?: { regexp: string }[] }][]) {
    if (/middleware|proxy/.test(name)) for (const x of fn.matchers ?? []) regexps.push(new RegExp(x.regexp))
  }
  expect(regexps.length).toBeGreaterThan(0)
  const runs = (p: string) => regexps.some(re => re.test(p))

  for (const p of ["/admin", "/admin/login", "/admin/orders/abc", "/api/admin/orders/status"]) {
    expect(runs(p), p).toBe(true)
  }
  for (const p of [
    "/", "/shop", "/product/cerave-hydrating-cleanser", "/checkout", "/journal", "/account",
    "/api/orders", "/api/promo", "/api/newsletter", "/api/webhooks/paystack", "/administrator", "/api/administer",
  ]) {
    expect(runs(p), p).toBe(false)
  }
})
