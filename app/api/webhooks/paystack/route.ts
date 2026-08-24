import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyPaystackSignature } from "@/lib/paystack"
import { fulfillPaidOrder } from "@/lib/supabase/orders"
import { sendOrderConfirmationIfNew } from "@/lib/email/order"

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get("x-paystack-signature")

  const valid = await verifyPaystackSignature(rawBody, signature)
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let event: { event?: string; data?: { reference?: string; status?: string } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (event.event === "charge.success" && event.data?.reference) {
    const db = createAdminClient()
    if (!db) {
      console.error("[webhook] service role not configured")
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
    }
    const result = await fulfillPaidOrder(db, event.data.reference)
    if (!result.ok) {
      console.error("[webhook] fulfill:", result.message)
    } else {
      void sendOrderConfirmationIfNew(event.data.reference, result.message)
    }
  }

  return NextResponse.json({ received: true })
}
