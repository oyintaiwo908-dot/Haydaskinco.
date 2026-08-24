import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit"

const FALLBACK: Record<string, number> = {
  HAYDA10: 10,
  WELCOME15: 15,
  SKINCARE20: 20,
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request)
    const limited = rateLimit(`promo:${ip}`, 30, 60_000)
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec)

    const body = await request.json()
    const code = String(body.code ?? "").trim().toUpperCase()
    if (!code) {
      return NextResponse.json({ valid: false, message: "Enter a promo code." }, { status: 400 })
    }

    const admin = createAdminClient()
    const server = admin ?? (await createClient())

    if (!server) {
      const pct = FALLBACK[code]
      if (!pct) {
        return NextResponse.json({ valid: false, message: "Invalid promo code." })
      }
      return NextResponse.json({ valid: true, code, discount_pct: pct })
    }

    const { data, error } = await server
      .from("promo_codes")
      .select("code, discount_pct, discount_ngn, max_uses, used_count, expires_at, is_active")
      .eq("code", code)
      .maybeSingle()

    if (error || !data || !data.is_active) {
      return NextResponse.json({ valid: false, message: "Invalid promo code." })
    }
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, message: "This promo code has expired." })
    }
    if (data.max_uses != null && data.used_count >= data.max_uses) {
      return NextResponse.json({ valid: false, message: "This promo code has reached its limit." })
    }

    return NextResponse.json({
      valid: true,
      code: data.code,
      discount_pct: data.discount_pct ?? 0,
      discount_ngn: data.discount_ngn ?? 0,
    })
  } catch (err) {
    console.error("[promo]", err)
    return NextResponse.json({ valid: false, message: "Could not validate promo." }, { status: 500 })
  }
}
