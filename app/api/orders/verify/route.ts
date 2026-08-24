import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isPaystackConfigured, toKobo, verifyTransaction } from "@/lib/paystack"
import { fulfillPaidOrder, releaseOrderStock } from "@/lib/supabase/orders"
import { sendOrderConfirmationIfNew } from "@/lib/email/order"
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit"

/** Dev-only mock fulfill when Paystack secret is absent. Never honor client mock in prod / with keys. */
function allowDevMockFulfill() {
  return (
    !isPaystackConfigured() &&
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_MOCK_CHECKOUT !== "false"
  )
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request)
    const limited = await rateLimit(`orders-verify:${ip}`, 20, 60_000)
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec)

    const body = await request.json()
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    const clientMock = Boolean(body.mock)

    if (!reference) {
      return NextResponse.json({ error: "Missing reference." }, { status: 400 })
    }

    const db = createAdminClient()
    if (!db) {
      return NextResponse.json(
        { error: "Server misconfigured (service role required)." },
        { status: 503 },
      )
    }

    const { data: order, error: orderError } = await db
      .from("orders")
      .select("id, reference, total, payment_status")
      .eq("reference", reference)
      .maybeSingle()

    if (orderError) {
      console.error("[orders/verify] lookup:", orderError.message)
      return NextResponse.json({ error: orderError.message }, { status: 500 })
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
        await db
          .from("orders")
          .update({ payment_status: "failed", updated_at: new Date().toISOString() })
          .eq("reference", reference)
        void releaseOrderStock(db, reference)
        return NextResponse.json(
          { ok: false, error: `Payment not successful (${tx.status}).` },
          { status: 400 },
        )
      }

      const expectedKobo = toKobo(Number(order.total))
      if (typeof tx.amount === "number" && tx.amount !== expectedKobo) {
        console.error(
          `[orders/verify] amount mismatch ref=${reference} paystack=${tx.amount} expected=${expectedKobo}`,
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
          { ok: false, error: result.message ?? "Could not complete order." },
          { status: 500 },
        )
      }

      void sendOrderConfirmationIfNew(reference, result.message)
      return NextResponse.json({
        ok: true,
        reference,
        message: result.message ?? "Payment confirmed.",
      })
    }

    if (!allowDevMockFulfill()) {
      return NextResponse.json(
        { ok: false, error: "Payments are not configured." },
        { status: 503 },
      )
    }

    const result = await fulfillPaidOrder(db, reference)
    if (result.ok) {
      void sendOrderConfirmationIfNew(reference, result.message)
    }
    return NextResponse.json({
      ok: result.ok,
      reference,
      mock: true,
      message: result.message ?? (result.ok ? "Payment confirmed." : "Could not complete order."),
      error: result.ok ? undefined : result.message,
    })
  } catch (err) {
    console.error("[orders/verify]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verify failed." },
      { status: 500 },
    )
  }
}
