/**
 * Sub admins see only recent orders (owner decision, confirmed by the client).
 *
 * "Weekly" is a rolling window: the last 7 days counted back from now. The database enforces
 * the same rule (supabase/migrations/032_sub_admin_orders_window.sql); this file only shapes
 * the admin UI and the status route so they agree with it.
 *
 * To switch to a calendar week (Monday 00:00 to now) change `subAdminWindowStart` here and the
 * `sub_admin_order_window_start()` function in the migration together.
 */
export const SUB_ADMIN_ORDER_WINDOW_DAYS = 7

export function subAdminWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - SUB_ADMIN_ORDER_WINDOW_DAYS * 24 * 60 * 60 * 1000)
}

export function isWithinSubAdminWindow(createdAt: string | Date, now: Date = new Date()): boolean {
  const t = new Date(createdAt).getTime()
  return Number.isFinite(t) && t >= subAdminWindowStart(now).getTime()
}

export const SUB_ADMIN_ORDERS_NOTE = `Showing orders from the last ${SUB_ADMIN_ORDER_WINDOW_DAYS} days. Older orders are available to full admins.`
