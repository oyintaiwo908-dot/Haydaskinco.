import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NEWSLETTER_PROMO_CODE } from "@/lib/email/client"
import { sendNewsletterWelcome } from "@/lib/email/send"
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  try {
    const ip = clientIp(request)
    const limited = rateLimit(`newsletter:${ip}`, 8, 60_000)
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec)

    const body = await request.json()
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const source = typeof body.source === "string" ? body.source.slice(0, 40) : "site"

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 })
    }

    const db = createAdminClient() ?? (await createClient())
    if (!db) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 })
    }

    const { error } = await db.from("newsletter_subscribers").insert({
      email,
      source,
      discount_code: NEWSLETTER_PROMO_CODE,
    })

    let already = false
    if (error) {
      if (error.code === "23505") {
        already = true
      } else {
        console.error("[newsletter]", error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    const mail = await sendNewsletterWelcome({ to: email, promoCode: NEWSLETTER_PROMO_CODE })
    if (!mail.ok) {
      return NextResponse.json(
        {
          error:
            mail.error ??
            "Could not send welcome email. Until your domain is verified in Resend, you can only send to the email on your Resend account.",
          saved: true,
          already,
        },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true, already, skipped: mail.skipped ?? false })
  } catch (err) {
    console.error("[newsletter]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Subscribe failed." },
      { status: 500 },
    )
  }
}
