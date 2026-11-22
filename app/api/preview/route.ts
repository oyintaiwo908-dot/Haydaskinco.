import { timingSafeEqual } from "node:crypto"

/**
 * Checks a holding-page preview key against SITE_PREVIEW_KEY (server env). Answers only
 * { ok: boolean }; the key itself never reaches the browser bundle. A convenience gate for the
 * team, not access control: the storefront pages are static and public either way.
 */
export async function POST(request: Request) {
  const expected = process.env.SITE_PREVIEW_KEY ?? ""
  let key = ""
  try {
    const body = (await request.json()) as { key?: unknown }
    key = typeof body.key === "string" ? body.key.slice(0, 200) : ""
  } catch {
    // fall through with an empty key
  }
  const a = Buffer.from(key)
  const b = Buffer.from(expected)
  const ok = expected.length >= 8 && a.length === b.length && timingSafeEqual(a, b)
  return Response.json({ ok }, { status: ok ? 200 : 403, headers: { "Cache-Control": "no-store" } })
}
