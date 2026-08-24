import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Vercel Cron: release unpaid stock holds older than 2 hours.
 * Secured by CRON_SECRET (Vercel sends Authorization: Bearer <CRON_SECRET>).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    )
  }

  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const db = createAdminClient()
  if (!db) {
    return NextResponse.json(
      { error: "Server misconfigured (service role required)." },
      { status: 503 },
    )
  }

  const { data, error } = await db.rpc("release_stale_stock_holds")
  if (error) {
    console.error("[cron/release-stock-holds]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const released = typeof data === "number" ? data : Number(data) || 0
  return NextResponse.json({ ok: true, released })
}
