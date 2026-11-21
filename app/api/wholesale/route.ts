import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendWholesaleNotify } from "@/lib/email/send"
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { EMAIL_RE, errorResponse, jsonError, readJsonObject, stringField } from "@/lib/api-guard"

export async function POST(request: Request) {
  try {
    const ip = clientIp(request)
    const limited = await rateLimit(`wholesale:${ip}`, 5, 60_000)
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec)

    const body = await readJsonObject(request, 16_000)
    const name = stringField(body, "name", 120, "Name")
    const business = stringField(body, "business", 160, "Business")
    const email = stringField(body, "email", 254, "Email").toLowerCase()
    const phone = stringField(body, "phone", 40, "Phone")
    const type = stringField(body, "type", 80, "Business type")
    const volume = stringField(body, "volume", 80, "Volume")
    const message = stringField(body, "message", 5_000, "Message")

    if (!name || !business || !EMAIL_RE.test(email) || !phone || !type) {
      return jsonError("Name, business, email, phone, and business type are required.", 400)
    }

    const db = createAdminClient() ?? (await createClient())
    if (!db) {
      return jsonError("Enquiries are temporarily unavailable.", 503)
    }

    const { error } = await db.from("wholesale_enquiries").insert({
      name,
      business,
      email,
      phone,
      type,
      volume,
      message,
    })

    if (error) {
      console.error("[wholesale]", error.message)
      return jsonError("Could not send your enquiry. Please try again.", 500)
    }

    await sendWholesaleNotify({ name, business, email, phone, type, volume, message })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse("wholesale", err, "Send failed.")
  }
}
