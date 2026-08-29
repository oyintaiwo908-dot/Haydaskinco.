import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createAdminServerClient } from "@/lib/supabase/server"
import { sendOrderFulfilled, sendOrderShipped } from "@/lib/email/send"
import { rowToOrder } from "@/lib/supabase/orders"
import type { OrderStatus } from "@/lib/orders"

const ALLOWED: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "fulfilled",
  "cancelled",
  "refunded",
]

export async function POST(request: Request) {
  try {
    const adminAuth = await createAdminServerClient()
    if (!adminAuth) {
      return NextResponse.json({ error: "Auth not configured." }, { status: 503 })
    }

    const {
      data: { user },
    } = await adminAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const service = createAdminClient()
    const db = service ?? adminAuth

    const { data: profile } = await db
      .from("profiles")
      .select("role, is_suspended")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.is_suspended) {
      return NextResponse.json({ error: "Account suspended." }, { status: 403 })
    }
    if (profile?.role !== "admin" && profile?.role !== "staff") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    const body = await request.json()
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    const status = body.status as OrderStatus

    if (!reference || !ALLOWED.includes(status)) {
      return NextResponse.json({ error: "Invalid reference or status." }, { status: 400 })
    }

    const { error } = await db
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("reference", reference)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (status === "shipped" || status === "fulfilled") {
      const { data } = await db
        .from("orders")
        .select("*")
        .eq("reference", reference)
        .maybeSingle()

      if (data) {
        const order = rowToOrder(data)
        const to = order.customer.email
        if (to) {
          if (status === "shipped") {
            await sendOrderShipped({
              to,
              name: order.customer.name,
              reference,
              items: order.items.map(i => ({
                name: i.name,
                quantity: i.quantity,
                price: i.price,
                image: i.image,
              })),
            })
          } else {
            await sendOrderFulfilled({
              to,
              name: order.customer.name,
              reference,
              items: order.items.map(i => ({
                name: i.name,
                quantity: i.quantity,
                price: i.price,
                image: i.image,
              })),
            })
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[admin/orders/status]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed." },
      { status: 500 },
    )
  }
}
