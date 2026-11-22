"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ShoppingBag, Heart, Star, ArrowRight, Package } from "lucide-react"
import { useFavorites } from "@/components/favorites-provider"
import { OrderItemThumb } from "@/components/order-item-thumb"
import { getMyOrders } from "@/lib/supabase/orders"
import { getMyReviews } from "@/lib/supabase/reviews"
import { getRewardsSummary, type RewardsSummary } from "@/lib/supabase/rewards"
import type { Order, OrderStatus } from "@/lib/orders"
import { formatPrice } from "@/lib/products"
import { cn } from "@/lib/utils"

const STATUS_STYLE: Record<OrderStatus, { label: string; cls: string }> = {
  fulfilled:  { label: "Delivered",  cls: "text-green-700 bg-green-50 border-green-200" },
  shipped:    { label: "Shipped",    cls: "text-purple-700 bg-purple-50 border-purple-200" },
  processing: { label: "Processing", cls: "text-blue-700 bg-blue-50 border-blue-200" },
  pending:    { label: "Pending",    cls: "text-gold bg-lavender border-gold/30" },
  cancelled:  { label: "Cancelled",  cls: "text-muted-foreground bg-muted border-border" },
  refunded:   { label: "Refunded",   cls: "text-destructive bg-destructive/10 border-destructive/20" },
}

function formatOrderDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function AccountPage() {
  const { favorites } = useFavorites()
  const [orders, setOrders] = useState<Order[]>([])
  const [reviews, setReviews] = useState<Awaited<ReturnType<typeof getMyReviews>>>([])
  const [rewards, setRewards] = useState<RewardsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([getMyOrders(), getMyReviews(), getRewardsSummary()]).then(
      ([orderData, reviewData, rewardsData]) => {
        if (cancelled) return
        setOrders(orderData)
        setReviews(reviewData)
        setRewards(rewardsData)
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const totalSpent = orders
    .filter(o => o.paymentStatus === "paid")
    .reduce((s, o) => s + o.total, 0)

  const recent = orders.slice(0, 3)
  const latest = orders[0]
  const latestCount = latest ? latest.items.reduce((n, i) => n + i.quantity, 0) : 0
  const reviewCount = reviews.length
  const nextGoal = rewards?.nextTierAt ?? 0
  const hasNextTier = Boolean(rewards && rewards.nextTier !== rewards.tier && nextGoal > 0)
  const progress = hasNextTier && rewards
    ? Math.min(100, Math.round((rewards.balance / nextGoal) * 100))
    : 0

  const stats = [
    {
      label: "Total Orders",
      value: loading ? "—" : orders.length,
      href: "/account/orders",
      icon: ShoppingBag,
    },
    {
      label: "Total Spent",
      value: loading ? "—" : formatPrice(totalSpent),
      href: "/account/orders",
      icon: Package,
    },
    {
      label: "Favourites",
      value: favorites.length,
      href: "/account/favorites",
      icon: Heart,
    },
    {
      label: "Reviews",
      value: loading ? "—" : reviewCount,
      href: "/account/reviews",
      icon: Star,
    },
  ]

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-5">
        <section className="flex flex-col justify-between border border-gold/30 bg-secondary p-6 md:p-8 lg:col-span-3">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] font-light uppercase tracking-[0.28em] text-gold">HAYDA Rewards</p>
              {rewards && (
                <span className="border border-gold/40 bg-lavender px-3 py-1 text-[11px] font-medium text-gold">
                  {rewards.tier} Member
                </span>
              )}
            </div>
            <p className="mt-5 font-serif text-6xl font-medium tabular-nums leading-none">
              {loading || !rewards ? "—" : rewards.balance.toLocaleString()}
            </p>
            <p className="mt-3 text-sm font-light text-muted-foreground">
              {rewards ? "points available" : "Earn 1 point per ₦100 spent"}
            </p>
            {rewards && (
              <p className="mt-4 max-w-sm text-sm font-light leading-relaxed text-foreground/80">
                Earn 1 point per ₦100 spent.
              </p>
            )}
            {!loading && !rewards && (
              <p className="mt-4 max-w-sm text-sm font-light leading-relaxed text-muted-foreground">
                Your balance will show here when rewards are available.
              </p>
            )}
            {hasNextTier && rewards && (
              <div className="mt-6 max-w-md">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-light text-muted-foreground">
                  <span>{rewards.tier}</span>
                  <span>
                    {rewards.balance.toLocaleString()} / {nextGoal.toLocaleString()} pts to {rewards.nextTier}
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden bg-background">
                  <div className="h-full bg-gold" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>
          <Link
            href="/account/rewards"
            className="mt-8 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-foreground transition-colors hover:text-gold"
          >
            View rewards <ArrowRight className="size-3" />
          </Link>
        </section>

        <section className="flex h-full flex-col border border-border p-6 md:p-8 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[11px] font-light uppercase tracking-[0.22em] text-muted-foreground">Latest order</h2>
            <Link
              href="/account/orders"
              className="text-[11px] font-light text-gold underline-offset-2 hover:underline"
            >
              View all
            </Link>
          </div>

          {loading ? (
            <div className="mt-5 h-28 animate-pulse bg-muted/40" />
          ) : !latest ? (
            <div className="mt-6 flex flex-1 flex-col">
              <p className="font-serif text-2xl font-medium">No orders yet</p>
              <p className="mt-2 text-sm font-light leading-relaxed text-muted-foreground">
                When you check out, your orders will show up here.
              </p>
              <Link
                href="/shop"
                className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-gold hover:underline"
              >
                Browse the shop <ArrowRight className="size-3" />
              </Link>
            </div>
          ) : (
            <Link
              href={`/account/orders/${latest.reference}`}
              className="group mt-5 flex flex-1 items-start gap-4"
            >
              {latest.items[0] ? (
                <OrderItemThumb
                  productId={latest.items[0].productId}
                  image={latest.items[0].image}
                  name={latest.items[0].name}
                  size="xl"
                  className="size-16 ring-0"
                  sizes="64px"
                />
              ) : (
                <div className="flex size-16 shrink-0 items-center justify-center border border-border bg-muted">
                  <ShoppingBag className="size-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium leading-snug">
                  {latest.items[0]?.name ?? "Order"}
                </p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{latest.reference}</p>
                <p className="mt-1 text-xs font-light text-muted-foreground">
                  {formatOrderDate(latest.createdAt)} · {latestCount} {latestCount === 1 ? "item" : "items"}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className={cn("border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]", STATUS_STYLE[latest.status].cls)}>
                    {STATUS_STYLE[latest.status].label}
                  </span>
                  <span className="text-sm font-medium">{formatPrice(latest.total)}</span>
                </div>
              </div>
            </Link>
          )}
        </section>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(stat => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group border border-border p-4 transition-colors hover:border-gold/40"
          >
            <stat.icon className="size-4 text-muted-foreground mb-3 group-hover:text-gold transition-colors" />
            <p className="font-serif text-2xl font-medium">{stat.value}</p>
            <p className="mt-0.5 text-[10px] font-light uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </p>
          </Link>
        ))}
      </div>

      {!loading && recent.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.2em]">Recent Orders</h2>
            <Link
              href="/account/orders"
              className="flex items-center gap-1 text-[11px] font-light text-gold hover:underline underline-offset-2"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="divide-y divide-border border border-border">
            {recent.map(order => {
              const s = STATUS_STYLE[order.status]
              const thumb = order.items[0]
              const itemCount = order.items.reduce((n, i) => n + i.quantity, 0)
              return (
                <Link
                  key={order.reference}
                  href={`/account/orders/${order.reference}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-secondary transition-colors group"
                >
                  {thumb ? (
                    <OrderItemThumb
                      productId={thumb.productId}
                      image={thumb.image}
                      name={thumb.name}
                      size="md"
                      className="size-12 ring-0"
                      sizes="48px"
                    />
                  ) : (
                    <div className="relative flex size-12 shrink-0 items-center justify-center border border-border bg-muted">
                      <ShoppingBag className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-medium">{order.reference}</p>
                    <p className="text-xs font-light text-muted-foreground mt-0.5">
                      {formatOrderDate(order.createdAt)} · {itemCount} item{itemCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={cn(
                        "hidden sm:block border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]",
                        s.cls,
                      )}
                    >
                      {s.label}
                    </span>
                    <p className="text-sm font-medium">{formatPrice(order.total)}</p>
                    <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-gold transition-colors" />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {favorites.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.2em]">Saved Favourites</h2>
            <Link
              href="/account/favorites"
              className="flex items-center gap-1 text-[11px] font-light text-gold hover:underline underline-offset-2"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
            {favorites.slice(0, 4).map(product => (
              <Link key={product.id} href={`/product/${product.id}`} className="group shrink-0 w-36">
                <div className="product-stage relative aspect-4/5 overflow-hidden">
                  <Image
                    src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    fill
                    sizes="144px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <p className="mt-2 text-xs font-medium leading-snug group-hover:text-gold transition-colors">
                  {product.name}
                </p>
                <p className="text-xs font-light text-muted-foreground">{formatPrice(product.price)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em]">Your Reviews</h2>
          <Link
            href="/account/reviews"
            className="flex items-center gap-1 text-[11px] font-light text-gold hover:underline underline-offset-2"
          >
            View all <ArrowRight className="size-3" />
          </Link>
        </div>
        {reviews.length === 0 ? (
          <div className="border border-border px-5 py-8 text-center">
            <p className="text-sm font-light text-muted-foreground">
              Reviews you write on product pages will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.slice(0, 2).map(r => (
              <div key={r.id} className="flex items-center justify-between border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{r.productName || r.title}</p>
                  <div className="mt-1 flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star
                        key={i}
                        className={cn(
                          "size-3",
                          i <= r.rating ? "fill-gold text-gold" : "fill-muted text-border",
                        )}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs font-light text-muted-foreground">
                  {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-border pt-6">
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Manage account", href: "/account/settings" },
            { label: "Track an order", href: "/account/orders" },
            { label: "Browse the shop", href: "/shop" },
            { label: "Read the journal", href: "/journal" },
          ].map(a => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-1.5 border border-border px-4 py-2 text-xs font-light uppercase tracking-[0.12em] hover:border-foreground hover:text-foreground transition-colors text-muted-foreground"
            >
              {a.label} <ArrowRight className="size-3" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
