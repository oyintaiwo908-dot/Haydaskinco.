import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NEWSLETTER_PROMO_CODE } from "@/lib/email/client"
import { sendNewsletterWelcome } from "@/lib/email/send"
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { EMAIL_RE, errorResponse, jsonError, readJsonObject, stringField } from "@/lib/api-guard"
import { SITE_HOLDING, holdingResponse } from "@/lib/holding"

export async function POST(request: Request) {
  // Holding page until launch: no orders or form posts from stale tabs (lib/holding.ts).
  if (SITE_HOLDING) return holdingResponse()
  try {
    const ip = clientIp(request)
    const limited = await rateLimit(`newsletter:${ip}`, 8, 60_000)
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec)

    const body = await readJsonObject(request, 2_000)
    const email = stringField(body, "email", 254, "Email").toLowerCase()
    const source = stringField(body, "source", 40, "Source") || "site"

    if (!EMAIL_RE.test(email)) {
      return jsonError("Valid email required.", 400)
    }

    // Per-address cap so one inbox cannot be targeted from many IPs.
    const perEmail = await rateLimit(`newsletter-email:${email}`, 3, 60 * 60_000)
    if (!perEmail.ok) return rateLimitResponse(perEmail.retryAfterSec)

    const db = createAdminClient() ?? (await createClient())
    if (!db) {
      return jsonError("Sign-ups are temporarily unavailable.", 503)
    }

    const { error } = await db.from("newsletter_subscribers").insert({
      email,
      source,
      discount_code: NEWSLETTER_PROMO_CODE,
    })

    if (error) {
      if (error.code === "23505") {
        // Already subscribed: do not send another email (stops using this
        // endpoint to mail arbitrary addresses) and do not reveal membership.
        return NextResponse.json({ ok: true })
      }
      console.error("[newsletter]", error.message)
      return jsonError("Could not subscribe. Please try again.", 500)
    }

    const mail = await sendNewsletterWelcome({ to: email, promoCode: NEWSLETTER_PROMO_CODE })
    if (!mail.ok) {
      console.error("[newsletter] welcome email:", mail.error)
      return jsonError(
        "You're subscribed, but we couldn't send the welcome email. Please try again later.",
        502,
        { saved: true },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse("newsletter", err, "Subscribe failed.")
  }
}
