import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendContactNotify } from "@/lib/email/send"
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  try {
    const ip = clientIp(request)
    const limited = rateLimit(`contact:${ip}`, 5, 60_000)
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec)

    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const subject = typeof body.subject === "string" ? body.subject.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""

    if (!name || !EMAIL_RE.test(email) || !message) {
      return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 })
    }

    const db = createAdminClient() ?? (await createClient())
    if (!db) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 })
    }

    const { error } = await db.from("contact_submissions").insert({
      name,
      email,
      subject,
      message,
    })

    if (error) {
      console.error("[contact]", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await sendContactNotify({ name, email, subject, message })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[contact]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed." },
      { status: 500 },
    )
  }
}
