import { after, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  paystackAmountMatches,
  verifyPaystackSignature,
  verifyTransaction,
} from "@/lib/paystack"
import { fulfillPaidOrder } from "@/lib/supabase/orders"
import { sendOrderConfirmationIfNew } from "@/lib/email/order"
import { revalidateStockForOrder } from "@/lib/stock-revalidate"

/** Paystack event bodies are small; refuse anything absurd before hashing it. */
const MAX_WEBHOOK_BYTES = 256_000

export async function POST(request: Request) {
  const rawBody = await request.text()
  if (rawBody.length > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }
  const signature = request.headers.get("x-paystack-signature")

  const valid = await verifyPaystackSignature(rawBody, signature)
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let event: {
    event?: string
    data?: { reference?: string; status?: string; amount?: number }
  }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (event.event === "charge.success" && typeof event.data?.reference === "string") {
    const reference = event.data.reference
    const db = createAdminClient()
    if (!db) {
      console.error("[webhook] service role not configured")
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
    }

    const { data: order, error: orderError } = await db
      .from("orders")
      .select("id, reference, total, payment_status")
      .eq("reference", reference)
      .maybeSingle()

    if (orderError || !order) {
      console.error("[webhook] order lookup:", orderError?.message ?? "not found", reference)
      return NextResponse.json({ received: true })
    }

    if (order.payment_status === "paid") {
      return NextResponse.json({ received: true })
    }

    try {
      // Never trust the event body for money: re-read the transaction from Paystack.
      const tx = await verifyTransaction(reference)
      if (tx.status !== "success") {
        console.error(`[webhook] tx not success ref=${reference} status=${tx.status}`)
        return NextResponse.json({ received: true })
      }
      if (!paystackAmountMatches(tx, Number(order.total))) {
        console.error(
          `[webhook] amount/currency mismatch ref=${reference} paystack=${tx.amount} ${tx.currency ?? "?"}`,
        )
        return NextResponse.json({ received: true })
      }
    } catch (err) {
      console.error("[webhook] verifyTransaction:", err)
      return NextResponse.json({ error: "Verify failed" }, { status: 500 })
    }

    const result = await fulfillPaidOrder(db, reference)
    if (!result.ok) {
      console.error("[webhook] fulfill:", result.message)
    } else {
      after(() => sendOrderConfirmationIfNew(reference, result.message))
      after(() => revalidateStockForOrder(db, reference))
    }
  }

  return NextResponse.json({ received: true })
}
