import type { OrderStatus, PaymentStatus } from "@/lib/orders"

/**
 * Client mirror of the transition table enforced by app/api/admin/orders/status/route.ts
 * (documented in README.md). The route is the source of truth: if they disagree, the route
 * answers 409 and the admin UI shows its message.
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

export type StatusTarget = { status: OrderStatus; disabledReason: string | null }

/** Status moves the server will accept for this order, with a reason when payment blocks one. */
export function allowedStatusTargets(order: { status: OrderStatus; paymentStatus: PaymentStatus }): StatusTarget[] {
  return (TRANSITIONS[order.status] ?? []).map(status => ({
    status,
    disabledReason:
      NEEDS_PAID.includes(status) && order.paymentStatus !== "paid" ? "Only paid orders can move here" : null,
  }))
}

/** POSTs a status change; resolves to the server's message when it refuses. */
export async function requestStatusChange(reference: string, status: OrderStatus): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/admin/orders/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, status }),
    })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, message: typeof data.error === "string" ? data.error : `Status update failed (${res.status}).` }
  } catch {
    return { ok: false, message: "Network error: the status was not changed." }
  }
}
