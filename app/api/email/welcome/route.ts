import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendWelcome } from "@/lib/email/send"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Welcome email after signup.
 * Requires a customer session whose email matches the body (stops open relay abuse).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const name = typeof body.name === "string" ? body.name.trim() : "there"

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 })
    }

    const supabase = await createClient("customer")
    if (!supabase) {
      // Local mock / no Supabase — allow only when env is missing (dev without DB)
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
      }
      await sendWelcome({ to: email, name: name || "there" })
      return NextResponse.json({ ok: true })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email || user.email.toLowerCase() !== email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    await sendWelcome({ to: email, name: name || "there" })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[email/welcome]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed." },
      { status: 500 },
    )
  }
}
