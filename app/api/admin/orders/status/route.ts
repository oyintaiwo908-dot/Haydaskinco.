import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createAdminServerClient } from "@/lib/supabase/server"
import { sendOrderFulfilled, sendOrderShipped } from "@/lib/email/send"
import { rowToOrder } from "@/lib/supabase/orders"
import type { OrderStatus } from "@/lib/orders"
import { SUB_ADMIN_ORDER_WINDOW_DAYS, isWithinSubAdminWindow } from "@/lib/order-window"
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

/**
 * The caller's store role: "admin", "sub_admin" (both not suspended, the same rule as RLS
 * is_admin() / is_store_manager()), or null. Read from the profile row with the service role,
 * so it does not depend on which migrations are applied.
 */
async function storeRole(
  userClient: NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>,
  userId: string,
): Promise<"admin" | "sub_admin" | null> {
  const db = createAdminClient() ?? userClient
  const { data: profile } = await db
    .from("profiles")
    .select("role, is_suspended")
    .eq("id", userId)
    .maybeSingle()
  if (!profile || profile.is_suspended) return null
  return profile.role === "admin" || profile.role === "sub_admin" ? profile.role : null
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
    const role = await storeRole(adminAuth, user.id)
    if (!role) {
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
      .select("status, payment_status, created_at")
      .eq("reference", reference)
      .maybeSingle()
    if (readError) {
      console.error("[admin/orders/status] read:", readError.message)
      return jsonError("Could not load the order.", 500)
    }
    if (!current) return jsonError("Order not found.", 404)
    // Sub admins may act only on orders inside their window (the same rule RLS applies to reads;
    // this route uses the service role, so it checks here).
    if (role === "sub_admin" && !isWithinSubAdminWindow(current.created_at)) {
      return jsonError(`Sub admins can only update orders from the last ${SUB_ADMIN_ORDER_WINDOW_DAYS} days.`, 403)
    }

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
