import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  toKobo,
  verifyPaystackSignature,
  verifyTransaction,
} from "@/lib/paystack"
import { fulfillPaidOrder } from "@/lib/supabase/orders"
import { sendOrderConfirmationIfNew } from "@/lib/email/order"

export async function POST(request: Request) {
  const rawBody = await request.text()
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

  if (event.event === "charge.success" && event.data?.reference) {
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
      const tx = await verifyTransaction(reference)
      if (tx.status !== "success") {
        console.error(`[webhook] tx not success ref=${reference} status=${tx.status}`)
        return NextResponse.json({ received: true })
      }
      const expectedKobo = toKobo(Number(order.total))
      if (typeof tx.amount === "number" && tx.amount !== expectedKobo) {
        console.error(
          `[webhook] amount mismatch ref=${reference} paystack=${tx.amount} expected=${expectedKobo}`,
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
      void sendOrderConfirmationIfNew(reference, result.message)
    }
  }

  return NextResponse.json({ received: true })
}
