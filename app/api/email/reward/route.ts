import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendRewardPromo } from "@/lib/email/send"
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit"

export async function POST(request: Request) {
  try {
    const ip = clientIp(request)
    const limited = await rateLimit(`email-reward:${ip}`, 5, 60_000)
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec)

    const body = await request.json()
    const promoCode = typeof body.promoCode === "string" ? body.promoCode.trim() : ""
    const discountNgn = Number(body.discountNgn) || 0

    if (!promoCode) {
      return NextResponse.json({ error: "Missing promo code." }, { status: 400 })
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: "Auth not configured." }, { status: 503 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 })
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
      return NextResponse.json({ error: "Could not verify reward." }, { status: 500 })
    }
    if (!redemption) {
      return NextResponse.json({ error: "Reward code not found for this account." }, { status: 403 })
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
    console.error("[email/reward]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed." },
      { status: 500 },
    )
  }
}
