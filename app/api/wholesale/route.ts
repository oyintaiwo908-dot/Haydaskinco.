import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendWholesaleNotify } from "@/lib/email/send"
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  try {
    const ip = clientIp(request)
    const limited = await rateLimit(`wholesale:${ip}`, 5, 60_000)
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec)

    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const business = typeof body.business === "string" ? body.business.trim() : ""
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const phone = typeof body.phone === "string" ? body.phone.trim() : ""
    const type = typeof body.type === "string" ? body.type.trim() : ""
    const volume = typeof body.volume === "string" ? body.volume.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""

    if (!name || !business || !EMAIL_RE.test(email) || !phone || !type) {
      return NextResponse.json(
        { error: "Name, business, email, phone, and business type are required." },
        { status: 400 },
      )
    }

    const db = createAdminClient() ?? (await createClient())
    if (!db) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 })
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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await sendWholesaleNotify({ name, business, email, phone, type, volume, message })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[wholesale]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed." },
      { status: 500 },
    )
  }
}
