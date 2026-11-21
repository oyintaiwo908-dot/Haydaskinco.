import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendContactNotify } from "@/lib/email/send"
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { EMAIL_RE, errorResponse, jsonError, readJsonObject, stringField } from "@/lib/api-guard"

export async function POST(request: Request) {
  try {
    const ip = clientIp(request)
    const limited = await rateLimit(`contact:${ip}`, 5, 60_000)
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec)

    const body = await readJsonObject(request, 16_000)
    const name = stringField(body, "name", 120, "Name")
    const email = stringField(body, "email", 254, "Email").toLowerCase()
    const subject = stringField(body, "subject", 200, "Subject")
    const message = stringField(body, "message", 5_000, "Message")

    if (!name || !EMAIL_RE.test(email) || !message) {
      return jsonError("Name, email, and message are required.", 400)
    }

    const db = createAdminClient() ?? (await createClient())
    if (!db) {
      return jsonError("Messages are temporarily unavailable.", 503)
    }

    const { error } = await db.from("contact_submissions").insert({
      name,
      email,
      subject,
      message,
    })

    if (error) {
      console.error("[contact]", error.message)
      return jsonError("Could not send your message. Please try again.", 500)
    }

    await sendContactNotify({ name, email, subject, message })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse("contact", err, "Send failed.")
  }
}
