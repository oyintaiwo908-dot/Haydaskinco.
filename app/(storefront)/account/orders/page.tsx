"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, ArrowRight, ShoppingBag } from "lucide-react"
import { cn } from "@/lib/utils"
import { getMyOrders } from "@/lib/supabase/orders"
import { OrderItemThumb } from "@/components/order-item-thumb"
import type { Order, OrderStatus } from "@/lib/orders"
import { formatPrice } from "@/lib/products"

const STATUS_STYLE: Record<OrderStatus, { label: string; cls: string }> = {
  fulfilled:  { label: "Delivered",  cls: "text-green-700 bg-green-50 border-green-200" },
  shipped:    { label: "Shipped",    cls: "text-purple-700 bg-purple-50 border-purple-200" },
  processing: { label: "Processing", cls: "text-blue-700 bg-blue-50 border-blue-200" },
  pending:    { label: "Pending",    cls: "text-gold bg-lavender border-gold/30" },
  cancelled:  { label: "Cancelled",  cls: "text-muted-foreground bg-muted border-border" },
  refunded:   { label: "Refunded",   cls: "text-destructive bg-destructive/10 border-destructive/20" },
}

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | OrderStatus>("all")

  useEffect(() => {
    getMyOrders().then(data => {
      setOrders(data)
      setLoading(false)
    })
  }, [])

  const filtered = orders.filter(o => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      o.id.toLowerCase().includes(q) ||
      o.items.some(i => i.name.toLowerCase().includes(q))
    const matchFilter = filter === "all" || o.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-medium">Order History</h2>
        <p className="mt-1 text-sm font-light text-muted-foreground">
          {loading ? "Loading…" : `${orders.length} order${orders.length !== 1 ? "s" : ""} placed`}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search orders or products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-border bg-background py-2.5 pl-10 pr-4 text-sm font-light outline-none focus:border-foreground transition-colors"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {(["all", "fulfilled", "shipped", "processing", "pending", "cancelled"] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={cn(
                "shrink-0 border px-3 py-1.5 text-[11px] font-light uppercase tracking-[0.1em] transition-all capitalize",
                filter === s
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? "All" : STATUS_STYLE[s].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 border border-border bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border py-16 text-center">
          <ShoppingBag className="size-10 text-muted-foreground mb-3" />
          <p className="font-serif text-lg font-medium">No orders found</p>
          <p className="mt-1 text-sm font-light text-muted-foreground">
            {orders.length === 0 ? "Orders you place will appear here." : "Try adjusting your search."}
          </p>
          {orders.length === 0 && (
            <Link href="/shop" className="mt-4 text-xs uppercase tracking-[0.15em] text-gold hover:underline">
              Shop now
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const s = STATUS_STYLE[order.status]
            const unpaid = order.paymentStatus === "pending"
            return (
              <Link
                key={order.reference}
                href={`/account/orders/${order.reference}`}
                className="group block border border-border hover:border-gold/40 transition-colors"
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    <p className="font-mono text-xs font-medium">{order.reference}</p>
                    <span className={cn("border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]", s.cls)}>
                      {s.label}
                    </span>
                    {unpaid && (
                      <span className="border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-amber-800">
                        Payment pending — open to confirm
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs font-light text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="text-sm font-medium">{formatPrice(order.total)}</p>
                    <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-gold transition-colors" />
                  </div>
                </div>
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex -space-x-2">
                    {order.items.slice(0, 3).map((item, i) => (
                      <OrderItemThumb
                        key={i}
                        productId={item.productId}
                        image={item.image}
                        name={item.name}
                        size="md"
                        className="border-background ring-1 ring-background"
                        sizes="40px"
                      />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-light text-muted-foreground truncate">
                      {order.items.map(i => i.name).join(", ")}
                    </p>
                    <p className="text-[10px] font-light text-muted-foreground mt-0.5 capitalize">
                      {order.items.reduce((sum, i) => sum + i.quantity, 0)} item
                      {order.items.reduce((sum, i) => sum + i.quantity, 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
