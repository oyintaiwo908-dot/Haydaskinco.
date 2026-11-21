import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createAdminServerClient } from "@/lib/supabase/server"
import { sendOrderFulfilled, sendOrderShipped } from "@/lib/email/send"
import { rowToOrder } from "@/lib/supabase/orders"
import type { OrderStatus } from "@/lib/orders"
import {
  errorResponse,
  forbiddenOrigin,
  isSameOriginRequest,
  jsonError,
  readJsonObject,
  stringField,
} from "@/lib/api-guard"

const ALL_STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "fulfilled",
  "cancelled",
  "refunded",
]

/**
 * Allowed status moves. Owners can widen this table.
 * `needsPaid` targets also require orders.payment_status = 'paid'.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["fulfilled", "processing", "refunded"],
  fulfilled: ["shipped", "refunded"],
  cancelled: ["pending", "refunded"],
  refunded: [],
}
const NEEDS_PAID: OrderStatus[] = ["processing", "shipped", "fulfilled", "refunded"]

/** Store manager = admin or sub_admin, not suspended (same rule as RLS is_store_manager()). */
async function isStoreManager(
  userClient: NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await userClient.rpc("is_store_manager")
  if (!error) return data === true

  // Migration 030 not applied yet: fall back to the profile row.
  const db = createAdminClient() ?? userClient
  const { data: profile } = await db
    .from("profiles")
    .select("role, is_suspended")
    .eq("id", userId)
    .maybeSingle()
  return Boolean(
    profile &&
      !profile.is_suspended &&
      (profile.role === "admin" || profile.role === "sub_admin"),
  )
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return forbiddenOrigin()

    const adminAuth = await createAdminServerClient()
    if (!adminAuth) {
      return jsonError("Auth not configured.", 503)
    }

    const {
      data: { user },
    } = await adminAuth.auth.getUser()
    if (!user) {
      return jsonError("Unauthorized.", 401)
    }
    if (!(await isStoreManager(adminAuth, user.id))) {
      return jsonError("Forbidden.", 403)
    }

    const body = await readJsonObject(request, 2_000)
    const reference = stringField(body, "reference", 80, "Reference")
    const status = body.status as OrderStatus

    if (!reference || !ALL_STATUSES.includes(status)) {
      return jsonError("Invalid reference or status.", 400)
    }

    const db = createAdminClient() ?? adminAuth

    const { data: current, error: readError } = await db
      .from("orders")
      .select("status, payment_status")
      .eq("reference", reference)
      .maybeSingle()
    if (readError) {
      console.error("[admin/orders/status] read:", readError.message)
      return jsonError("Could not load the order.", 500)
    }
    if (!current) return jsonError("Order not found.", 404)

    const from = current.status as OrderStatus
    if (from === status) return NextResponse.json({ ok: true, unchanged: true })

    if (!(TRANSITIONS[from] ?? []).includes(status)) {
      return jsonError(`An order cannot move from ${from} to ${status}.`, 409)
    }
    if (NEEDS_PAID.includes(status) && current.payment_status !== "paid") {
      return jsonError(`Only paid orders can be marked ${status}.`, 409)
    }

    // Compare-and-set on the old status so two admins cannot race each other.
    const { data: updated, error } = await db
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("reference", reference)
      .eq("status", from)
      .select("*")
      .maybeSingle()

    if (error) {
      console.error("[admin/orders/status] update:", error.message)
      return jsonError("Update failed.", 500)
    }
    if (!updated) {
      return jsonError("The order changed while you were editing it. Reload and try again.", 409)
    }

    if (status === "shipped" || status === "fulfilled") {
      const order = rowToOrder(updated)
      const to = order.customer.email
      if (to) {
        const items = order.items.map(i => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          image: i.image,
        }))
        if (status === "shipped") {
          await sendOrderShipped({ to, name: order.customer.name, reference, items })
        } else {
          await sendOrderFulfilled({ to, name: order.customer.name, reference, items })
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse("admin/orders/status", err, "Update failed.")
  }
}
