/**
 * Order query helpers for admin + customer UIs.
 * Falls back to mock lib/orders only when Supabase is not configured.
 */
import { createClient, createAdminBrowserClient } from "@/lib/supabase/client"
import {
  orders as mockOrders,
  type Order,
  type OrderItem,
  type OrderStatus,
  type PaymentStatus,
  type PaymentMethod,
  type ShippingAddress,
} from "@/lib/orders"

export type CheckoutItem = {
  productId: string
  name: string
  image: string
  category: string
  /** Client-computed unit price — ignored for totals; server re-prices from DB. */
  price: number
  quantity: number
  /** Optional selected SKU/variant list price; validated against product variants. */
  skuPrice?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToOrder(row: any): Order {
  const addr = (row.shipping_address ?? {}) as ShippingAddress & {
    email?: string
    firstName?: string
    lastName?: string
  }
  const email = row.guest_email ?? addr.email ?? ""
  const name =
    [addr.firstName, addr.lastName].filter(Boolean).join(" ") ||
    email.split("@")[0] ||
    "Customer"
  const initials = name
    .split(/\s+/)
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CU"

  const items: OrderItem[] = Array.isArray(row.items)
    ? row.items.map((i: CheckoutItem) => ({
        productId: i.productId,
        name: i.name,
        image: i.image || "/placeholder.svg",
        category: i.category || "",
        price: Number(i.price),
        quantity: Number(i.quantity),
      }))
    : []

  return {
    id: row.reference ?? row.id,
    reference: row.reference,
    customer: {
      id: row.user_id ?? "guest",
      name,
      email,
      initials,
    },
    items,
    shippingAddress: {
      firstName: addr.firstName ?? "",
      lastName: addr.lastName ?? "",
      address: addr.address ?? "",
      apartment: addr.apartment,
      city: addr.city ?? "",
      state: addr.state ?? "",
      zip: addr.zip ?? "",
      country: addr.country ?? "Nigeria",
      phone: addr.phone,
    },
    shippingMethod: row.shipping_method === "express" ? "express" : "standard",
    shippingCost: Number(row.shipping_cost ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    tax: Number(row.tax ?? 0),
    total: Number(row.total ?? 0),
    status: (row.status ?? "pending") as OrderStatus,
    paymentStatus: (row.payment_status === "paid"
      ? "paid"
      : row.payment_status === "failed"
        ? "failed"
        : row.payment_status === "refunded"
          ? "refunded"
          : "pending") as PaymentStatus,
    paymentMethod: (row.payment_method ?? "card") as PaymentMethod,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getAllOrders(): Promise<Order[]> {
  const supabase = createAdminBrowserClient()
  if (!supabase) return mockOrders

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[orders] getAllOrders:", error.message)
    return []
  }
  return (data ?? []).map(rowToOrder)
}

export type OrdersPageQuery = {
  search?: string
  status?: OrderStatus | "all"
  sort?: "date_desc" | "date_asc" | "total_desc" | "total_asc"
  /** Look back N months from now. */
  months?: 1 | 2 | 3
  page?: number
  pageSize?: number
}

export async function getAdminOrdersPage(
  q: OrdersPageQuery = {},
): Promise<{ orders: Order[]; total: number; kpis: { revenue: number; pending: number; shipped: number; fulfilled: number } }> {
  const page = Math.max(1, q.page ?? 1)
  const pageSize = Math.max(1, q.pageSize ?? 20)
  const months = q.months ?? 1
  const fromIso = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - months)
    return d.toISOString()
  })()

  const supabase = createAdminBrowserClient()
  if (!supabase) {
    let pool = mockOrders.filter(o => new Date(o.createdAt).getTime() >= new Date(fromIso).getTime())
    if (q.status && q.status !== "all") pool = pool.filter(o => o.status === q.status)
    if (q.search?.trim()) {
      const s = q.search.trim().toLowerCase()
      pool = pool.filter(
        o =>
          o.id.toLowerCase().includes(s) ||
          o.customer.name.toLowerCase().includes(s) ||
          o.customer.email.toLowerCase().includes(s) ||
          o.reference.toLowerCase().includes(s),
      )
    }
    pool = [...pool].sort((a, b) => {
      switch (q.sort) {
        case "date_asc": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case "total_desc": return b.total - a.total
        case "total_asc": return a.total - b.total
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })
    const offset = (page - 1) * pageSize
    return {
      orders: pool.slice(offset, offset + pageSize),
      total: pool.length,
      kpis: {
        revenue: pool.filter(o => o.paymentStatus === "paid").reduce((s, o) => s + o.total, 0),
        pending: pool.filter(o => o.status === "pending").length,
        shipped: pool.filter(o => o.status === "shipped").length,
        fulfilled: pool.filter(o => o.status === "fulfilled").length,
      },
    }
  }

  // KPI pool: all orders in date range (status filter still applied for consistency)
  let kpiQ = supabase.from("orders").select("*").gte("created_at", fromIso)
  if (q.status && q.status !== "all") kpiQ = kpiQ.eq("status", q.status)
  const { data: kpiRows } = await kpiQ
  const kpiOrders = (kpiRows ?? []).map(rowToOrder)
  let kpiFiltered = kpiOrders
  if (q.search?.trim()) {
    const s = q.search.trim().toLowerCase()
    kpiFiltered = kpiOrders.filter(
      o =>
        o.id.toLowerCase().includes(s) ||
        o.customer.name.toLowerCase().includes(s) ||
        o.customer.email.toLowerCase().includes(s) ||
        o.reference.toLowerCase().includes(s),
    )
  }

  // Paged query — search is applied client-side on the range window when present,
  // otherwise use DB pagination for scale.
  let listQ = supabase.from("orders").select("*", { count: "exact" }).gte("created_at", fromIso)
  if (q.status && q.status !== "all") listQ = listQ.eq("status", q.status)

  switch (q.sort) {
    case "date_asc":
      listQ = listQ.order("created_at", { ascending: true })
      break
    case "total_desc":
      listQ = listQ.order("total", { ascending: false })
      break
    case "total_asc":
      listQ = listQ.order("total", { ascending: true })
      break
    default:
      listQ = listQ.order("created_at", { ascending: false })
  }

  if (q.search?.trim()) {
    // Fetch range-window then filter/paginate in memory (search spans JSON fields)
    const { data, error } = await listQ
    if (error) {
      console.error("[orders] getAdminOrdersPage:", error.message)
      return { orders: [], total: 0, kpis: { revenue: 0, pending: 0, shipped: 0, fulfilled: 0 } }
    }
    const s = q.search.trim().toLowerCase()
    const filtered = (data ?? []).map(rowToOrder).filter(
      o =>
        o.id.toLowerCase().includes(s) ||
        o.customer.name.toLowerCase().includes(s) ||
        o.customer.email.toLowerCase().includes(s) ||
        o.reference.toLowerCase().includes(s),
    )
    const offset = (page - 1) * pageSize
    return {
      orders: filtered.slice(offset, offset + pageSize),
      total: filtered.length,
      kpis: {
        revenue: kpiFiltered.filter(o => o.paymentStatus === "paid").reduce((sum, o) => sum + o.total, 0),
        pending: kpiFiltered.filter(o => o.status === "pending").length,
        shipped: kpiFiltered.filter(o => o.status === "shipped").length,
        fulfilled: kpiFiltered.filter(o => o.status === "fulfilled").length,
      },
    }
  }

  const from = (page - 1) * pageSize
  const { data, error, count } = await listQ.range(from, from + pageSize - 1)
  if (error) {
    console.error("[orders] getAdminOrdersPage:", error.message)
    return { orders: [], total: 0, kpis: { revenue: 0, pending: 0, shipped: 0, fulfilled: 0 } }
  }

  return {
    orders: (data ?? []).map(rowToOrder),
    total: count ?? 0,
    kpis: {
      revenue: kpiFiltered.filter(o => o.paymentStatus === "paid").reduce((sum, o) => sum + o.total, 0),
      pending: kpiFiltered.filter(o => o.status === "pending").length,
      shipped: kpiFiltered.filter(o => o.status === "shipped").length,
      fulfilled: kpiFiltered.filter(o => o.status === "fulfilled").length,
    },
  }
}

export async function getOrderByReference(reference: string): Promise<Order | null> {
  const adminClient = createAdminBrowserClient()
  const customerClient = createClient()

  // Prefer admin session when signed in as admin (admin order detail).
  if (adminClient) {
    const { data: { user: adminUser } } = await adminClient.auth.getUser()
    if (adminUser) {
      return fetchOrderByRef(adminClient, reference)
    }
  }

  if (!customerClient) {
    return mockOrders.find(o => o.id === reference || o.reference === reference) ?? null
  }

  await claimGuestOrdersForSession(customerClient)
  return fetchOrderByRef(customerClient, reference)
}

async function fetchOrderByRef(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  reference: string,
): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("reference", reference)
    .maybeSingle()

  if (!error && data) return rowToOrder(data)

  const { data: byId, error: idErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", reference)
    .maybeSingle()

  if (idErr) {
    console.error("[orders] getOrderByReference:", idErr.message)
    return null
  }
  if (error && !byId) {
    console.error("[orders] getOrderByReference:", error.message)
  }
  return byId ? rowToOrder(byId) : null
}

/** Attach guest checkouts (same email, null user_id) to the signed-in account. */
async function claimGuestOrdersForSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
) {
  const { error } = await supabase.rpc("claim_guest_orders")
  if (error) {
    // Migration 008 may not be applied yet — RLS email match still helps once it is.
    console.error("[orders] claim_guest_orders:", error.message)
  }
}

export async function getMyOrders(): Promise<Order[]> {
  const supabase = createClient()
  if (!supabase) return mockOrders

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  await claimGuestOrdersForSession(supabase)

  const email = user.email?.trim().toLowerCase()

  // Owned by user_id, plus matching guest_email / shipping email
  const [{ data: owned, error: ownedErr }, emailResult, shipResult] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    email
      ? supabase
          .from("orders")
          .select("*")
          .ilike("guest_email", email)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as unknown[], error: null }),
    email
      ? supabase
          .from("orders")
          .select("*")
          .filter("shipping_address->>email", "ilike", email)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ])

  if (ownedErr) {
    console.error("[orders] getMyOrders:", ownedErr.message)
  }
  if (emailResult.error) {
    console.error("[orders] getMyOrders email:", emailResult.error.message)
  }
  if (shipResult.error) {
    console.error("[orders] getMyOrders shipping email:", shipResult.error.message)
  }

  const byRef = new Map<string, ReturnType<typeof rowToOrder>>()
  for (const row of [
    ...(owned ?? []),
    ...(emailResult.data ?? []),
    ...(shipResult.data ?? []),
  ]) {
    const order = rowToOrder(row)
    byRef.set(order.reference, order)
  }

  return Array.from(byRef.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function updateOrderStatus(
  reference: string,
  status: OrderStatus,
): Promise<string | null> {
  const supabase = createAdminBrowserClient()
  if (!supabase) return "Supabase not configured."

  const { error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("reference", reference)

  if (error) return error.message
  return null
}

/**
 * Mark order paid + decrement stock + bump promo via security-definer RPC.
 * Requires a service-role client (migration 026 revoked anon/authenticated execute).
 */
export async function fulfillPaidOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  reference: string,
): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await client.rpc("complete_order_payment", {
    p_reference: reference,
  })

  if (error) return { ok: false, message: error.message }
  if (data && typeof data === "object" && "ok" in data) {
    return { ok: Boolean(data.ok), message: data.message as string | undefined }
  }
  return { ok: true }
}
