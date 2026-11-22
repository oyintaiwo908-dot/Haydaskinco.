/**
 * Holding page until launch.
 *
 * NEXT_PUBLIC_SITE_HOLDING=1 turns it on (anything else, or unset: off). It is read at build
 * time (NEXT_PUBLIC_ variables are inlined), so changing it needs a redeploy. While on:
 * - every storefront page renders the holding page (app/(storefront)/layout.tsx)
 * - pages are noindex, robots.txt disallows everything, the sitemap lists only the home page
 * - public POST endpoints (orders, promo, newsletter, contact, wholesale) answer 503
 * - the Paystack webhook and order verification keep working for orders already in flight
 * - the admin is unaffected
 *
 * Team preview: open any page with ?preview=<SITE_PREVIEW_KEY>. The key is checked by
 * /api/preview (server env, never sent to the browser) and the browser remembers the preview.
 * This is a convenience gate, not security: see components/holding-gate.tsx.
 */
export const SITE_HOLDING = process.env.NEXT_PUBLIC_SITE_HOLDING === "1"

export const HOLDING_MESSAGE =
  "We're currently working on the website. Ordering is not open yet. Please contact us by email or WhatsApp."

/** 503 for public write endpoints while the holding page is on. */
export function holdingResponse(): Response {
  return Response.json(
    { error: HOLDING_MESSAGE },
    { status: 503, headers: { "Retry-After": "86400", "Cache-Control": "no-store" } },
  )
}
