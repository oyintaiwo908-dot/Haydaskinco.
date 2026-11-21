import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { readJsonObject, stringField, ValidationError } from "@/lib/api-guard"

function invalid(message = "Invalid promo code.", status = 200) {
  return NextResponse.json({ valid: false, message }, { status })
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request)
    const limited = await rateLimit(`promo:${ip}`, 30, 60_000)
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec)

    const body = await readJsonObject(request, 1_000)
    const code = stringField(body, "code", 40, "Promo code").toUpperCase()
    if (!code) {
      return invalid("Enter a promo code.", 400)
    }

    const db = createAdminClient()
    if (!db) {
      console.error("[promo] SUPABASE_SERVICE_ROLE_KEY is not configured")
      return invalid("Could not validate promo.", 503)
    }

    const { data, error } = await db
      .from("promo_codes")
      .select("code, discount_pct, discount_ngn, max_uses, used_count, expires_at, is_active")
      .eq("code", code)
      .maybeSingle()

    if (error || !data || !data.is_active) {
      return invalid()
    }
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return invalid("This promo code has expired.")
    }
    if (data.max_uses != null && data.used_count >= data.max_uses) {
      return invalid("This promo code has reached its limit.")
    }

    const isReward = code.startsWith("RWD-")
    if (isReward) {
      // Reward codes only work for the account that redeemed them (same rule as /api/orders).
      const customer = await createClient("customer")
      const user = customer ? (await customer.auth.getUser()).data.user : null
      if (!user) return invalid("Sign in to use this rewards code.")
      const { data: redemption } = await db
        .from("reward_redemptions")
        .select("id")
        .eq("promo_code", code)
        .eq("user_id", user.id)
        .maybeSingle()
      if (!redemption) return invalid()
    }

    return NextResponse.json({
      valid: true,
      code: data.code,
      kind: isReward ? "reward" : "promo",
      discount_pct: data.discount_pct ?? 0,
      discount_ngn: data.discount_ngn ?? 0,
    })
  } catch (err) {
    if (err instanceof ValidationError) return invalid(err.message, 400)
    console.error("[promo]", err)
    return invalid("Could not validate promo.", 500)
  }
}
