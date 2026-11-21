import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendRewardPromo } from "@/lib/email/send"
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import {
  errorResponse,
  forbiddenOrigin,
  isSameOriginRequest,
  jsonError,
  readJsonObject,
  stringField,
} from "@/lib/api-guard"

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return forbiddenOrigin()

    const ip = clientIp(request)
    const limited = await rateLimit(`email-reward:${ip}`, 5, 60_000)
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec)

    const body = await readJsonObject(request, 1_000)
    // discountNgn from the client is ignored; the amount comes from promo_codes.
    const promoCode = stringField(body, "promoCode", 40, "Promo code").toUpperCase()

    if (!promoCode) {
      return jsonError("Missing promo code.", 400)
    }

    const supabase = await createClient()
    if (!supabase) {
      return jsonError("Auth not configured.", 503)
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) {
      return jsonError("Sign in required.", 401)
    }

    // Only email codes the signed-in user actually redeemed
    const { data: redemption, error: redemptionError } = await supabase
      .from("reward_redemptions")
      .select("id, promo_code")
      .eq("user_id", user.id)
      .eq("promo_code", promoCode)
      .maybeSingle()

    if (redemptionError) {
      console.error("[email/reward] redemption:", redemptionError.message)
      return jsonError("Could not verify reward.", 500)
    }
    if (!redemption) {
      return jsonError("Reward code not found for this account.", 403)
    }

    const db = createAdminClient() ?? supabase
    const { data: promo } = await db
      .from("promo_codes")
      .select("discount_ngn")
      .eq("code", promoCode)
      .maybeSingle()
    const discountNgn = Number(promo?.discount_ngn) || 0
    if (discountNgn <= 0) {
      return jsonError("Reward code not found for this account.", 403)
    }

    const name =
      (user.user_metadata?.full_name as string | undefined)?.trim() ||
      (user.user_metadata?.first_name as string | undefined)?.trim() ||
      user.email.split("@")[0]

    await sendRewardPromo({
      to: user.email,
      name,
      promoCode,
      discountNgn,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse("email/reward", err, "Send failed.")
  }
}
