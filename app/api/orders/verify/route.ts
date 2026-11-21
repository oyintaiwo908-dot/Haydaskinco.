import { after, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  allowMockCheckout,
  isPaystackConfigured,
  isFinalFailureStatus,
  paystackAmountMatches,
  verifyTransaction,
} from "@/lib/paystack"
import { fulfillPaidOrder } from "@/lib/supabase/orders"
import { sendOrderConfirmationIfNew } from "@/lib/email/order"
import { revalidateStockForOrder } from "@/lib/stock-revalidate"
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { errorResponse, jsonError, readJsonObject, stringField } from "@/lib/api-guard"

export async function POST(request: Request) {
  try {
    const ip = clientIp(request)
    const limited = await rateLimit(`orders-verify:${ip}`, 20, 60_000)
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec)

    const body = await readJsonObject(request, 2_000)
    const reference = stringField(body, "reference", 80, "Reference")
    const clientMock = Boolean(body.mock)

    if (!reference) {
      return jsonError("Missing reference.", 400)
    }

    const db = createAdminClient()
    if (!db) {
      console.error("[orders/verify] SUPABASE_SERVICE_ROLE_KEY is not configured")
      return jsonError("Payment confirmation is temporarily unavailable.", 503)
    }

    const { data: order, error: orderError } = await db
      .from("orders")
      .select("id, reference, total, payment_status")
      .eq("reference", reference)
      .maybeSingle()

    if (orderError) {
      console.error("[orders/verify] lookup:", orderError.message)
      return jsonError("Could not look up the order.", 500)
    }
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 })
    }

    if (order.payment_status === "paid") {
      return NextResponse.json({
        ok: true,
        reference,
        message: "Payment already confirmed.",
      })
    }

    if (isPaystackConfigured()) {
      if (clientMock) {
        console.warn(`[orders/verify] ignoring client mock for ${reference} (Paystack configured)`)
      }

      const tx = await verifyTransaction(reference)
      if (tx.status !== "success") {
        // Only record a failure Paystack considers final. "abandoned" / "ongoing" /
        // "pending" can still succeed, and anyone holding the reference can call this.
        if (isFinalFailureStatus(tx.status)) {
          await db
            .from("orders")
            .update({ payment_status: "failed", updated_at: new Date().toISOString() })
            .eq("reference", reference)
            .eq("payment_status", "unpaid")
        }
        return NextResponse.json(
          { ok: false, error: "Payment has not been completed yet." },
          { status: 400 },
        )
      }

      if (!paystackAmountMatches(tx, Number(order.total))) {
        console.error(
          `[orders/verify] amount/currency mismatch ref=${reference} paystack=${tx.amount} ${tx.currency ?? "?"}`,
        )
        return NextResponse.json(
          { ok: false, error: "Paid amount does not match order total." },
          { status: 400 },
        )
      }

      const result = await fulfillPaidOrder(db, reference)
      if (!result.ok) {
        console.error("[orders/verify] fulfill:", result.message)
        return NextResponse.json(
          { ok: false, error: "Could not complete the order. Please contact support." },
          { status: 500 },
        )
      }

      after(() => sendOrderConfirmationIfNew(reference, result.message))
      after(() => revalidateStockForOrder(db, reference))
      return NextResponse.json({
        ok: true,
        reference,
        message: result.message ?? "Payment confirmed.",
      })
    }

    if (!allowMockCheckout()) {
      return NextResponse.json(
        { ok: false, error: "Payments are not configured." },
        { status: 503 },
      )
    }

    const result = await fulfillPaidOrder(db, reference)
    if (result.ok) {
      after(() => sendOrderConfirmationIfNew(reference, result.message))
      after(() => revalidateStockForOrder(db, reference))
    }
    return NextResponse.json({
      ok: result.ok,
      reference,
      mock: true,
      message: result.message ?? (result.ok ? "Payment confirmed." : "Could not complete order."),
      error: result.ok ? undefined : result.message,
    })
  } catch (err) {
    return errorResponse("orders/verify", err, "Could not verify payment. Please try again.")
  }
}
