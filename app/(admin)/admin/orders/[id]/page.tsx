"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import {
  ArrowLeft, MapPin, Mail, Phone, Package, CreditCard,
  Truck, Clock, CheckCircle2, ChevronDown, Copy, Check,
} from "lucide-react"
import {
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  PAYMENT_METHOD_LABELS,
  type Order,
  type OrderStatus,
} from "@/lib/orders"
import { getOrderByReference } from "@/lib/supabase/orders"
import { OrderItemThumb } from "@/components/order-item-thumb"
import { allowedStatusTargets, requestStatusChange } from "@/components/admin-order-status"
import { cn } from "@/lib/utils"

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n)
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

const STATUS_TIMELINE: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: "pending",    label: "Order placed", icon: Clock },
  { status: "processing", label: "Processing",   icon: Package },
  { status: "shipped",    label: "Shipped",      icon: Truck },
  { status: "fulfilled",  label: "Delivered",    icon: CheckCircle2 },
]

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusOpen, setStatusOpen] = useState(false)
  const [copiedRef, setCopiedRef] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusNotice, setStatusNotice] = useState<{ kind: "error" | "ok"; message: string } | null>(null)

  useEffect(() => {
    getOrderByReference(id).then(o => {
      setOrder(o)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page-body">
          <div className="h-8 w-48 bg-muted/50 animate-pulse mb-6" />
          <div className="h-64 w-full bg-muted/30 animate-pulse" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
        <p className="font-serif text-2xl font-medium">Order not found</p>
        <Link href="/admin/orders" className="text-xs uppercase tracking-[0.15em] text-gold hover:underline">
          Back to orders
        </Link>
      </div>
    )
  }

  const statusMeta = ORDER_STATUS_META[order.status]
  const paymentMeta = PAYMENT_STATUS_META[order.paymentStatus]
  const isCancelled = order.status === "cancelled" || order.status === "refunded"
  const progressStatuses: OrderStatus[] = ["pending", "processing", "shipped", "fulfilled"]
  const progressIdx = isCancelled ? -1 : progressStatuses.indexOf(order.status)

  const targets = allowedStatusTargets(order)

  /** No optimistic change: the server enforces the transition table and may refuse (409). */
  async function updateStatus(status: OrderStatus) {
    setStatusOpen(false)
    setSaving(true)
    setStatusNotice(null)
    const res = await requestStatusChange(order!.reference, status)
    const fresh = await getOrderByReference(id)
    setOrder(fresh)
    setSaving(false)
    setStatusNotice(
      res.ok
        ? { kind: "ok", message: `Order moved to ${ORDER_STATUS_META[status].label}.` }
        : { kind: "error", message: res.message },
    )
  }

  function copyRef() {
    navigator.clipboard.writeText(order!.reference)
    setCopiedRef(true)
    setTimeout(() => setCopiedRef(false), 1800)
  }

  return (
    <div className="admin-page" onClick={() => setStatusOpen(false)}>
      <div className="admin-page-header sm:items-start lg:items-center">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <Link
            href="/admin/orders"
            className="flex size-8 shrink-0 items-center justify-center border border-border text-muted-foreground hover:border-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-serif text-lg font-medium font-mono sm:text-2xl truncate">{order.id}</h1>
            <p className="text-xs font-light text-muted-foreground">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>
        <div className="relative w-full sm:w-auto" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setStatusOpen(v => !v)}
            disabled={saving || targets.length === 0}
            aria-expanded={statusOpen}
            aria-label={`Status: ${statusMeta.label}. ${targets.length ? "Change status" : "No further changes allowed"}`}
            className={cn(
              "flex w-full items-center justify-center gap-2 border px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] disabled:cursor-default sm:w-auto",
              statusMeta.border, statusMeta.bg, statusMeta.color,
            )}
          >
            {saving ? "Saving…" : statusMeta.label}
            {targets.length > 0 && !saving && <ChevronDown aria-hidden className="size-3.5" />}
          </button>
          {statusOpen && (
            <div
              className="absolute right-0 top-full z-30 mt-1 w-56 border border-border bg-background shadow-lg"
              onKeyDown={e => e.key === "Escape" && setStatusOpen(false)}
            >
              <p className="px-4 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Move to</p>
              {targets.map(t => (
                <button
                  key={t.status}
                  type="button"
                  disabled={Boolean(t.disabledReason)}
                  title={t.disabledReason ?? undefined}
                  onClick={() => updateStatus(t.status)}
                  className="flex w-full flex-col items-start px-4 py-2.5 text-left text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <span className="font-medium">{ORDER_STATUS_META[t.status].label}</span>
                  {t.disabledReason && <span className="text-[10px] text-muted-foreground">{t.disabledReason}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {statusNotice && (
        <div
          role={statusNotice.kind === "error" ? "alert" : "status"}
          className={cn(
            "mx-4 flex items-start justify-between gap-3 border px-4 py-3 text-sm sm:mx-6 lg:mx-8",
            statusNotice.kind === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-success/30 bg-success/5 text-success",
          )}
        >
          <p>{statusNotice.message}</p>
          <button type="button" onClick={() => setStatusNotice(null)} className="shrink-0 text-xs underline underline-offset-4">
            Dismiss
          </button>
        </div>
      )}

      <div className="admin-page-body grid gap-8 lg:grid-cols-3">
        <div className="flex min-h-0 flex-col gap-6 lg:col-span-2">
          {/* Timeline */}
          <div className="border border-border p-6">
            <h2 className="mb-5 text-xs font-medium uppercase tracking-[0.15em]">Status</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {STATUS_TIMELINE.map((step, i) => {
                const done = progressIdx >= i
                const Icon = step.icon
                return (
                  <div key={step.status} className="flex flex-1 flex-col items-center gap-2 text-center">
                    <div className={cn(
                      "flex size-9 items-center justify-center rounded-full border",
                      done ? "border-gold bg-lavender text-gold" : "border-border text-muted-foreground",
                    )}>
                      <Icon className="size-4" />
                    </div>
                    <p className={cn("text-[10px] uppercase tracking-[0.12em]", done ? "text-foreground" : "text-muted-foreground")}>
                      {step.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Items */}
          <div className="admin-table-panel border border-border">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-xs font-medium uppercase tracking-[0.15em]">Items</h2>
            </div>
            <ul className="divide-y divide-border">
              {order.items.map(item => (
                <li key={item.productId + item.name} className="flex items-center gap-4 px-6 py-4">
                  <OrderItemThumb
                    productId={item.productId}
                    image={item.image}
                    name={item.name}
                    size="lg"
                    sizes="56px"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs font-light text-muted-foreground">
                      {item.productId.startsWith("deal__") ? "Bundle Deal" : item.category} · Qty {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-medium">{formatCurrency(item.price * item.quantity)}</p>
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-6 py-4 space-y-1.5">
              <Row label="Subtotal" value={formatCurrency(order.subtotal)} />
              <Row label="Shipping" value={order.shippingCost === 0 ? "Free" : formatCurrency(order.shippingCost)} />
              <Row label="Tax" value={formatCurrency(order.tax)} />
              <Row label="Total" value={formatCurrency(order.total)} bold />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="border border-border p-5 space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-[0.15em]">Customer</h2>
            <p className="text-sm font-medium">{order.customer.name}</p>
            <p className="flex items-center gap-2 text-xs font-light text-muted-foreground">
              <Mail className="size-3.5" /> {order.customer.email}
            </p>
            {order.shippingAddress.phone && (
              <p className="flex items-center gap-2 text-xs font-light text-muted-foreground">
                <Phone className="size-3.5" /> {order.shippingAddress.phone}
              </p>
            )}
          </div>

          <div className="border border-border p-5 space-y-2">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.15em] flex items-center gap-2">
              <MapPin className="size-3.5" /> Shipping
            </h2>
            <p className="text-sm font-light">
              {order.shippingAddress.firstName} {order.shippingAddress.lastName}
            </p>
            <p className="text-xs font-light text-muted-foreground leading-relaxed">
              {order.shippingAddress.address}
              {order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ""}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}
              <br />
              {order.shippingAddress.country}
            </p>
            <p className="text-xs font-light text-muted-foreground pt-1 capitalize">
              {order.shippingMethod} shipping
            </p>
          </div>

          <div className="border border-border p-5 space-y-2">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.15em] flex items-center gap-2">
              <CreditCard className="size-3.5" /> Payment
            </h2>
            <p className={cn("text-sm font-medium", paymentMeta.color)}>{paymentMeta.label}</p>
            <p className="text-xs font-light text-muted-foreground">
              {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
            </p>
            <button
              type="button"
              onClick={copyRef}
              className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground"
            >
              {copiedRef ? <Check className="size-3" /> : <Copy className="size-3" />}
              {order.reference}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="font-light text-muted-foreground">{label}</span>
      <span className={bold ? "font-medium" : "font-light"}>{value}</span>
    </div>
  )
}
