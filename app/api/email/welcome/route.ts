import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendWelcome } from "@/lib/email/send"
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import {
  EMAIL_RE,
  errorResponse,
  forbiddenOrigin,
  isSameOriginRequest,
  jsonError,
  readJsonObject,
  stringField,
} from "@/lib/api-guard"

/**
 * Welcome email after signup.
 * Requires a customer session whose email matches the body (stops open relay abuse).
 */
export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return forbiddenOrigin()

    const ip = clientIp(request)
    const limited = await rateLimit(`email-welcome:${ip}`, 5, 60_000)
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec)

    const body = await readJsonObject(request, 2_000)
    const email = stringField(body, "email", 254, "Email").toLowerCase()
    const name = stringField(body, "name", 120, "Name") || "there"

    if (!EMAIL_RE.test(email)) {
      return jsonError("Valid email required.", 400)
    }

    const supabase = await createClient("customer")
    if (!supabase) {
      // Local mock / no Supabase — allow only when env is missing (dev without DB)
      if (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NODE_ENV === "production") {
        return jsonError("Unauthorized.", 401)
      }
      await sendWelcome({ to: email, name })
      return NextResponse.json({ ok: true })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email || user.email.toLowerCase() !== email) {
      return jsonError("Unauthorized.", 401)
    }

    // One welcome per address per day, however many sessions / IPs ask.
    const perEmail = await rateLimit(`email-welcome-to:${email}`, 1, 24 * 60 * 60_000)
    if (!perEmail.ok) return NextResponse.json({ ok: true, skipped: true })

    await sendWelcome({ to: email, name })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse("email/welcome", err, "Send failed.")
  }
}
