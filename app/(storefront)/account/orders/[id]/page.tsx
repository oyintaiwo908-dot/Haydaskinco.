"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Package } from "lucide-react"
import { getOrderByReference } from "@/lib/supabase/orders"
import type { Order } from "@/lib/orders"
import { formatPrice } from "@/lib/products"
import { ORDER_STATUS_META } from "@/lib/orders"
import { cn } from "@/lib/utils"
import { useCart } from "@/components/cart-provider"
import { OrderItemThumb } from "@/components/order-item-thumb"
import { DELIVERY_LINE_LABEL } from "@/lib/storefront-copy"

export default function AccountOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { clearCart } = useCart()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null)

  async function load() {
    const o = await getOrderByReference(id)
    setOrder(o)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function confirmPayment() {
    if (!order) return
    setConfirming(true)
    setConfirmMsg(null)
    try {
      const res = await fetch("/api/orders/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: order.reference }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        clearCart()
        setConfirmMsg("Payment confirmed.")
        await load()
      } else {
        setConfirmMsg(data.error ?? data.message ?? "Could not confirm payment.")
      }
    } catch {
      setConfirmMsg("Network error while confirming payment.")
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return <div className="h-48 bg-muted/30 animate-pulse" />
  }

  if (!order) {
    return (
      <div className="py-16 text-center space-y-3">
        <Package className="size-10 mx-auto text-muted-foreground" />
        <p className="font-serif text-xl font-medium">Order not found</p>
        <Link href="/account/orders" className="text-xs uppercase tracking-[0.15em] text-gold hover:underline">
          Back to orders
        </Link>
      </div>
    )
  }

  const status = ORDER_STATUS_META[order.status]
  const unpaid = order.paymentStatus === "pending"

  return (
    <div className="space-y-6">
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1.5 text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-medium font-mono">{order.id}</h2>
          <p className="mt-1 text-sm font-light text-muted-foreground">
            Placed {new Date(order.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
          <p className="mt-1 text-xs font-light uppercase tracking-[0.12em] text-muted-foreground">
            Payment: {order.paymentStatus}
          </p>
        </div>
        <span className={cn("border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em]", status.border, status.bg, status.color)}>
          {status.label}
        </span>
      </div>

      {unpaid && (
        <div className="border border-border bg-secondary p-4 space-y-3">
          <p className="text-sm font-light text-muted-foreground">
            If Paystack already charged you, confirm the payment here to update this order and clear your cart.
          </p>
          <button
            type="button"
            onClick={confirmPayment}
            disabled={confirming}
            className="bg-foreground px-6 py-2.5 text-xs font-medium uppercase tracking-[0.15em] text-background disabled:opacity-50"
          >
            {confirming ? "Confirming…" : "I’ve paid — confirm order"}
          </button>
          {confirmMsg && (
            <p className="text-xs font-light text-muted-foreground">{confirmMsg}</p>
          )}
        </div>
      )}

      <div className="border border-border divide-y divide-border">
        {order.items.map(item => (
          <div key={item.productId + item.name} className="flex items-center gap-4 p-4">
            <OrderItemThumb
              productId={item.productId}
              image={item.image}
              name={item.name}
              size="xl"
              sizes="64px"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.name}</p>
              <p className="text-xs font-light text-muted-foreground">
                {item.productId.startsWith("deal__") ? "Bundle Deal" : item.category}
                {" · "}Qty {item.quantity}
              </p>
            </div>
            <p className="text-sm font-medium">{formatPrice(item.price * item.quantity)}</p>
          </div>
        ))}
      </div>

      <div className="border border-border p-5 space-y-2 max-w-sm ml-auto">
        <div className="flex justify-between text-sm">
          <span className="font-light text-muted-foreground">Subtotal</span>
          <span>{formatPrice(order.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-light text-muted-foreground">Delivery</span>
          {/* Delivery is quoted and paid after the order; older orders may carry a fee. */}
          <span>{order.shippingCost === 0 ? DELIVERY_LINE_LABEL : formatPrice(order.shippingCost)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-light text-muted-foreground">VAT</span>
          <span>{formatPrice(order.tax)}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-border pt-2 font-medium">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>
      </div>
    </div>
  )
}
