"use client"

import { useState, useEffect, useCallback } from "react"
import { useAdminListParams, useAdminScrollRestore } from "@/components/admin-list-state"
import Link from "next/link"
import {
  Search, TrendingUp, ShoppingBag,
  Clock, CheckCircle2, XCircle, ArrowUpRight, ArrowUpDown,
  ChevronDown, Download, RefreshCw,
} from "lucide-react"
import {
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  PAYMENT_METHOD_LABELS,
  type Order,
  type OrderStatus,
} from "@/lib/orders"
import { getAdminOrdersPage } from "@/lib/supabase/orders"
import { useAdminAuth } from "@/components/admin-auth-provider"
import { SUB_ADMIN_ORDERS_NOTE, SUB_ADMIN_ORDER_WINDOW_DAYS, subAdminWindowStart } from "@/lib/order-window"
import { OrderItemThumb } from "@/components/order-item-thumb"
import { allowedStatusTargets, requestStatusChange } from "@/components/admin-order-status"
import {
  AdminPagination,
  ADMIN_PAGE_SIZE,
  MONTH_RANGE_OPTIONS,
  type MonthRange,
} from "@/components/admin-pagination"
import { cn } from "@/lib/utils"

const STATUSES: { value: "all" | OrderStatus; label: string }[] = [
  { value: "all", label: "All Orders" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
]

type SortKey = "date_desc" | "date_asc" | "total_desc" | "total_asc"

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "total_desc", label: "Highest value" },
  { value: "total_asc", label: "Lowest value" },
]

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string, short = false) {
  return new Date(iso).toLocaleDateString("en-US", short
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }
  )
}

type OrdersPageData = { orders: Order[]; total: number; kpis: { revenue: number; pending: number; shipped: number; fulfilled: number } }

export default function AdminOrdersPage() {
  // Search, filters, sort and page live in the URL so returning from an order reopens this view.
  const [query, setQuery] = useAdminListParams({ q: "", status: "all", sort: "date_desc", months: "1", page: "1" })
  const searchDebounced = query.q
  const statusFilter = query.status as "all" | OrderStatus
  const sortKey = query.sort as SortKey
  const months = Number(query.months) as MonthRange
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const setPage = (n: number) => setQuery({ page: String(n) })
  const [search, setSearch] = useState(query.q)
  const [showSort, setShowSort] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)
  const [statusNotice, setStatusNotice] = useState<{ kind: "error" | "ok"; message: string } | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  // Sub admins see only the last week of orders (RLS enforces it too): no month range, no export.
  const { session } = useAdminAuth()
  const limited = session?.role === "sub_admin"

  // Filter changes go back to page 1 (set in the handlers, not in an effect).
  const setStatusFilter = (v: "all" | OrderStatus) => setQuery({ status: v, page: "1" })
  const setSortKey = (v: SortKey) => setQuery({ sort: v, page: "1" })
  const setMonths = (v: MonthRange) => setQuery({ months: String(v), page: "1" })

  useEffect(() => {
    if (search === query.q) return
    const t = setTimeout(() => setQuery({ q: search, page: "1" }), 300)
    return () => clearTimeout(t)
  }, [search, query.q, setQuery])

  const queryKey = JSON.stringify([searchDebounced, statusFilter, sortKey, months, page, reloadTick, limited])
  const [result, setResult] = useState<{ key: string; data: OrdersPageData } | null>(null)
  const loading = result?.key !== queryKey
  const orders = result?.data.orders ?? []
  const total = result?.data.total ?? 0
  const kpis = result?.data.kpis ?? { revenue: 0, pending: 0, shipped: 0, fulfilled: 0 }

  useEffect(() => {
    let cancelled = false
    const key = JSON.stringify([searchDebounced, statusFilter, sortKey, months, page, reloadTick, limited])
    getAdminOrdersPage({
      search: searchDebounced,
      status: statusFilter,
      sort: sortKey,
      months,
      since: limited ? subAdminWindowStart() : undefined,
      page,
      pageSize: ADMIN_PAGE_SIZE,
    }).then(data => {
      if (!cancelled) setResult({ key, data })
    })
    return () => { cancelled = true }
  }, [searchDebounced, statusFilter, sortKey, months, page, reloadTick, limited])

  const load = useCallback(() => setReloadTick(t => t + 1), [])
  useAdminScrollRestore(!loading)

  /** No optimistic change: the server enforces the transition table and may refuse. */
  async function updateStatus(id: string, status: OrderStatus) {
    setUpdating(id)
    setStatusNotice(null)
    const res = await requestStatusChange(id, status)
    setUpdating(null)
    if (res.ok) {
      setStatusNotice({ kind: "ok", message: `Order ${id} moved to ${ORDER_STATUS_META[status].label}.` })
    } else {
      setStatusNotice({ kind: "error", message: `Order ${id}: ${res.message}` })
    }
    load()
  }

  const monthsLabel = limited
    ? `Last ${SUB_ADMIN_ORDER_WINDOW_DAYS} days`
    : (MONTH_RANGE_OPTIONS.find(o => o.value === months)?.label ?? "Last month")

  return (
    <div className="admin-page" onClick={() => setShowSort(false)}>
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif text-2xl font-medium">Orders</h1>
          <p className="text-xs font-light text-muted-foreground mt-0.5">
            {loading
              ? "Loading…"
              : `${total} order${total !== 1 ? "s" : ""} · ${formatCurrency(kpis.revenue)} revenue · ${monthsLabel.toLowerCase()}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!limited && <div className="flex gap-1.5">
            {MONTH_RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMonths(opt.value)}
                className={cn(
                  "border px-3 py-1.5 text-[11px] font-light uppercase tracking-[0.12em] transition-all",
                  months === opt.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="flex size-9 items-center justify-center border border-border text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
          {!limited && (
            <button className="hidden sm:flex items-center gap-2 border border-border px-4 py-2 text-xs font-light uppercase tracking-[0.15em] text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">
              <Download className="size-3.5" /> Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="admin-page-body space-y-6">
        {limited && (
          <p data-testid="sub-admin-orders-note" className="border border-border bg-secondary/60 px-4 py-3 text-sm font-light text-foreground">
            {SUB_ADMIN_ORDERS_NOTE}
          </p>
        )}
        {statusNotice && (
          <div
            role={statusNotice.kind === "error" ? "alert" : "status"}
            className={cn(
              "flex items-start justify-between gap-3 border px-4 py-3 text-sm",
              statusNotice.kind === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-success/30 bg-success/5 text-success",
            )}
          >
            <p>{statusNotice.message}</p>
            <button type="button" onClick={() => setStatusNotice(null)} className="shrink-0 text-xs underline underline-offset-4">
              Dismiss
            </button>
          </div>
        )}
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Total Revenue" value={formatCurrency(kpis.revenue)} sub={`${total} orders`} icon={TrendingUp} highlight />
          <KpiCard label="Pending" value={String(kpis.pending)} sub="Awaiting processing" icon={Clock} />
          <KpiCard label="Shipped" value={String(kpis.shipped)} sub="En route to customer" icon={ShoppingBag} />
          <KpiCard label="Fulfilled" value={String(kpis.fulfilled)} sub="Successfully delivered" icon={CheckCircle2} />
        </div>

        {/* Filters row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search orders"
              placeholder="Order ID, customer, reference…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-border bg-background py-2.5 pl-10 pr-4 text-sm font-light outline-none focus:border-foreground transition-colors"
            />
          </div>

          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowSort(v => !v)}
              className="flex items-center gap-2 border border-border px-3 py-2.5 text-xs font-light text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
            >
              <ArrowUpDown className="size-3.5" />
              {SORT_OPTIONS.find(s => s.value === sortKey)?.label}
              <ChevronDown className="size-3.5" />
            </button>
            {showSort && (
              <div className="absolute right-0 top-11 z-30 min-w-44 border border-border bg-background shadow-md">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setSortKey(opt.value); setShowSort(false) }}
                    className={cn(
                      "flex w-full items-center px-4 py-2.5 text-xs font-light transition-colors hover:bg-muted",
                      sortKey === opt.value ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {STATUSES.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatusFilter(s.value)}
              className={cn(
                "shrink-0 border px-3 py-1.5 text-[11px] font-light uppercase tracking-[0.12em] transition-all",
                statusFilter === s.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Orders table */}
        {loading && orders.length === 0 ? (
          <div className="admin-table-panel border border-border divide-y divide-border">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse bg-muted/20" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="admin-table-panel flex flex-col items-center justify-center border border-dashed border-border py-20 text-center">
            <XCircle className="size-10 text-muted-foreground mb-3" />
            <p className="font-serif text-lg font-medium">No orders found</p>
            <p className="mt-1 text-sm font-light text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="admin-table-panel border border-border">
            <div className="admin-table-scroll hidden lg:block">
              <table className="admin-data-table w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary">
                    {["Order", "Customer", "Items", "Total", "Payment", "Status", "Date", ""].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground last:text-right">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map(order => (
                    <OrderRow key={order.id} order={order} onStatusChange={updateStatus} busy={updating === order.id} />
                  ))}
                  <tr className="admin-table-fill" aria-hidden="true">
                    <td colSpan={8} />
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border lg:hidden">
              {orders.map(order => (
                <MobileOrderCard key={order.id} order={order} />
              ))}
            </div>
          </div>
        )}

        <AdminPagination
          page={page}
          pageSize={ADMIN_PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}

/* ─── Desktop Row ──────────────────────────────────────────── */
function OrderRow({ order, onStatusChange, busy }: { order: Order; onStatusChange: (id: string, s: OrderStatus) => void; busy?: boolean }) {
  const [open, setOpen] = useState(false)
  const meta = ORDER_STATUS_META[order.status]
  const pmeta = PAYMENT_STATUS_META[order.paymentStatus]
  const targets = allowedStatusTargets(order)

  return (
    <tr className="hover:bg-secondary transition-colors group">
      <td className="px-5 py-4">
        <Link href={`/admin/orders/${order.id}`} className="font-mono text-xs font-medium text-foreground hover:text-gold transition-colors">
          {order.id}
        </Link>
        <p className="text-[10px] font-light text-muted-foreground mt-0.5">
          {PAYMENT_METHOD_LABELS[order.paymentMethod]}
        </p>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
            {order.customer.initials}
          </div>
          <div>
            <p className="text-sm font-medium">{order.customer.name}</p>
            <p className="text-[10px] font-light text-muted-foreground">{order.customer.email}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex -space-x-2">
          {order.items.slice(0, 1).map((item, i) => (
            <OrderItemThumb
              key={i}
              productId={item.productId}
              image={item.image}
              name={item.name}
              size="sm"
              className="border-background ring-1 ring-background"
              sizes="32px"
            />
          ))}
        </div>
        <p className="mt-1 text-[10px] font-light text-muted-foreground">
          {order.items.reduce((s, i) => s + i.quantity, 0)} item{order.items.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}
        </p>
      </td>
      <td className="px-5 py-4">
        <p className="text-sm font-medium">{formatCurrency(order.total)}</p>
        <p className={cn("text-[10px] font-medium mt-0.5", pmeta.color)}>{pmeta.label}</p>
      </td>
      <td className="px-5 py-4">
        <p className="text-xs font-light text-muted-foreground">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
        <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5 truncate max-w-24">{order.reference}</p>
      </td>
      <td className="px-5 py-4">
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            disabled={busy || targets.length === 0}
            aria-expanded={open}
            aria-label={`Status: ${meta.label}. ${targets.length ? "Change status" : "No further changes allowed"}`}
            className={cn(
              "flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] transition-colors hover:opacity-80 disabled:cursor-default disabled:hover:opacity-100",
              meta.bg, meta.color, meta.border,
            )}
          >
            {busy ? "Saving…" : meta.label}
            {targets.length > 0 && !busy && <ChevronDown aria-hidden className="size-3" />}
          </button>
          {open && (
            <div className="absolute left-0 top-8 z-30 min-w-52 border border-border bg-background shadow-md" onKeyDown={e => e.key === "Escape" && setOpen(false)}>
              <p className="px-4 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Move to</p>
              {targets.map(t => (
                <button
                  key={t.status}
                  type="button"
                  disabled={Boolean(t.disabledReason)}
                  title={t.disabledReason ?? undefined}
                  onClick={() => { onStatusChange(order.id, t.status); setOpen(false) }}
                  className="flex w-full flex-col items-start px-4 py-2 text-left text-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <span className="font-medium">{ORDER_STATUS_META[t.status].label}</span>
                  {t.disabledReason && <span className="text-[10px] text-muted-foreground">{t.disabledReason}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="px-5 py-4">
        <p className="text-xs font-light text-muted-foreground whitespace-nowrap">{formatDate(order.createdAt, true)}</p>
      </td>
      <td className="px-5 py-4 text-right">
        <Link
          href={`/admin/orders/${order.id}`}
          className="inline-flex items-center gap-1 text-[11px] font-light text-muted-foreground hover:text-gold transition-colors"
        >
          View <ArrowUpRight className="size-3" />
        </Link>
      </td>
    </tr>
  )
}

/* ─── Mobile card ──────────────────────────────────────────── */
function MobileOrderCard({ order }: { order: Order }) {
  const meta = ORDER_STATUS_META[order.status]
  return (
    <Link href={`/admin/orders/${order.id}`} className="flex items-center gap-3 p-4 hover:bg-secondary transition-colors">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {order.customer.initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-mono text-xs font-medium">{order.id}</p>
          <span className={cn("border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em]", meta.bg, meta.color, meta.border)}>
            {meta.label}
          </span>
        </div>
        <p className="text-xs font-light text-muted-foreground truncate">{order.customer.name}</p>
        <p className="text-[10px] font-light text-muted-foreground">{formatDate(order.createdAt, true)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium">{formatCurrency(order.total)}</p>
        <p className="text-[10px] font-light text-muted-foreground">
          {order.items.reduce((s, i) => s + i.quantity, 0)} item{order.items.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}
        </p>
      </div>
    </Link>
  )
}

/* ─── KPI card ─────────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon: Icon, highlight }: {
  label: string; value: string; sub: string; icon: React.ElementType; highlight?: boolean
}) {
  return (
    <div className={cn("border p-5", highlight ? "border-gold/40 bg-lavender" : "border-border bg-card")}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-light uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <Icon className={cn("size-4", highlight ? "text-gold" : "text-muted-foreground")} />
      </div>
      <p className={cn("font-serif font-medium", value.startsWith("$") ? "text-2xl" : "text-3xl")}>{value}</p>
      <p className="mt-1 text-[10px] font-light text-muted-foreground">{sub}</p>
    </div>
  )
}
