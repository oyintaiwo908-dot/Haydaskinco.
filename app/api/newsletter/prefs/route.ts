import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NEWSLETTER_PROMO_CODE } from "@/lib/email/client"
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import {
  errorResponse,
  forbiddenOrigin,
  isSameOriginRequest,
  jsonError,
  readJsonObject,
} from "@/lib/api-guard"

/** Sync account newsletter preference ↔ newsletter_subscribers */
export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return forbiddenOrigin()

    const ip = clientIp(request)
    const limited = await rateLimit(`newsletter-prefs:${ip}`, 20, 60_000)
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec)

    const body = await readJsonObject(request, 1_000)
    const subscribed = Boolean(body.newsletter)

    const supabase = await createClient("customer")
    if (!supabase) {
      return jsonError("Auth not configured.", 503)
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) {
      return jsonError("Sign in required.", 401)
    }

    const email = user.email.trim().toLowerCase()
    const db = createAdminClient() ?? supabase

    if (subscribed) {
      const { error } = await db.from("newsletter_subscribers").upsert(
        {
          email,
          source: "account",
          discount_code: NEWSLETTER_PROMO_CODE,
        },
        { onConflict: "email" },
      )
      if (error) {
        console.error("[newsletter/prefs] upsert:", error.message)
        return jsonError("Could not update your preference.", 500)
      }
    } else {
      const { error } = await db.from("newsletter_subscribers").delete().eq("email", email)
      if (error) {
        console.error("[newsletter/prefs] delete:", error.message)
        return jsonError("Could not update your preference.", 500)
      }
    }

    return NextResponse.json({ ok: true, subscribed })
  } catch (err) {
    return errorResponse("newsletter/prefs", err, "Sync failed.")
  }
}
