"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Gift, Star, ShoppingBag, Zap, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getRewardsSummary,
  redeemReward,
  REWARD_CATALOG,
  type RewardsSummary,
} from "@/lib/supabase/rewards"

const WAYS_TO_EARN = [
  { icon: ShoppingBag, label: "Place an order", desc: "Earn 1 point per ₦100 spent" },
  { icon: Star, label: "Write a product review", desc: "+50 points per review" },
  { icon: Zap, label: "Complete your profile", desc: "+100 points (name + phone)" },
  { icon: Gift, label: "Refer a friend", desc: "Coming soon" },
]

export default function RewardsPage() {
  const [summary, setSummary] = useState<RewardsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setSummary(await getRewardsSummary())
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleRedeem(id: string) {
    setRedeeming(id)
    setMessage(null)
    const res = await redeemReward(id)
    setRedeeming(null)
    if (res.ok && res.promoCode) {
      setMessage(`Redeemed! ₦${res.discountNgn?.toLocaleString()} off will apply automatically at checkout.`)
      void fetch("/api/email/reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoCode: res.promoCode, discountNgn: res.discountNgn }),
      })
      await load()
    } else {
      setMessage(res.message ?? "Could not redeem reward.")
    }
  }

  const balance = summary?.balance ?? 0
  const nextAt = summary?.nextTierAt ?? 2000
  const progress = nextAt > 0 ? Math.round((balance / nextAt) * 100) : 0

  if (loading) {
    return <div className="h-64 border border-border bg-muted/20 animate-pulse" />
  }

  if (!summary) {
    return (
      <div className="border border-dashed border-border py-16 text-center space-y-3">
        <p className="font-serif text-xl font-medium">Sign in to view rewards</p>
        <Link href="/login" className="inline-block text-xs uppercase tracking-[0.15em] text-gold hover:underline">
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="border border-gold/40 bg-gradient-to-br from-lavender via-background to-secondary p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-gold">HAYDA Rewards</p>
            <p className="mt-1 font-serif text-5xl font-medium tabular-nums">{balance.toLocaleString()}</p>
            <p className="mt-1 text-sm font-light text-muted-foreground">points available</p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 border border-gold/40 bg-lavender px-3 py-1 text-xs font-medium text-gold">
              <Gift className="size-3.5" /> {summary.tier} Member
            </span>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-light text-muted-foreground">
            <span>{summary.tier}</span>
            <span>
              {balance.toLocaleString()} / {nextAt.toLocaleString()} pts
              {summary.nextTier !== summary.tier ? ` to ${summary.nextTier}` : ""}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gold transition-all duration-700"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {message && (
        <p className="border border-border bg-secondary px-4 py-3 text-sm font-light">{message}</p>
      )}

      <div>
        <h2 className="mb-4 font-serif text-xl font-medium">Redeem Points</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REWARD_CATALOG.map(r => {
            const canRedeem = balance >= r.cost
            return (
              <div
                key={r.id}
                className={cn(
                  "flex flex-col justify-between gap-4 border p-4 transition-all",
                  canRedeem ? "border-border hover:border-gold/60" : "border-border/50 opacity-60",
                )}
              >
                <div>
                  <p className="text-sm font-medium leading-snug">{r.label}</p>
                  <p className="mt-1 text-xs font-light text-muted-foreground">{r.cost.toLocaleString()} points</p>
                </div>
                <button
                  type="button"
                  disabled={!canRedeem || redeeming === r.id}
                  onClick={() => handleRedeem(r.id)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] transition-all",
                    canRedeem
                      ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                      : "cursor-not-allowed border-border text-muted-foreground",
                  )}
                >
                  {redeeming === r.id ? "Redeeming…" : canRedeem ? "Redeem" : "Not enough points"}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-4 font-serif text-xl font-medium">Ways to Earn Points</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {WAYS_TO_EARN.map(w => (
            <div key={w.label} className="flex items-start gap-4 border border-border p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lavender text-gold">
                <w.icon className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{w.label}</p>
                <p className="mt-0.5 text-xs font-light text-muted-foreground">{w.desc}</p>
              </div>
              <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground/40" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-4 font-serif text-xl font-medium">Points History</h2>
        {summary.history.length === 0 ? (
          <p className="border border-border px-5 py-8 text-center text-sm font-light text-muted-foreground">
            No points activity yet. Place an order or write a review to start earning.
          </p>
        ) : (
          <div className="divide-y divide-border border border-border">
            {summary.history.map(h => (
              <div key={h.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium">{h.label}</p>
                  <p className="mt-0.5 text-xs font-light text-muted-foreground">{h.date}</p>
                </div>
                <span className={cn(
                  "font-medium tabular-nums text-sm",
                  h.points > 0 ? "text-success" : "text-red-600",
                )}>
                  {h.points > 0 ? `+${h.points}` : h.points} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border border-border p-6 text-center">
        <p className="font-serif text-xl font-medium">Start earning faster</p>
        <p className="mt-2 text-sm font-light text-muted-foreground max-w-sm mx-auto">
          Shop new arrivals or leave a review on a recent purchase to boost your points balance.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/checkout"
            className="border border-foreground px-7 py-2.5 text-xs font-medium uppercase tracking-[0.15em] text-foreground transition-all hover:bg-foreground hover:text-background"
          >
            Go to Checkout
          </Link>
          <Link
            href="/shop"
            className="border border-border px-7 py-2.5 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground transition-all hover:border-foreground hover:text-foreground"
          >
            Shop Now
          </Link>
        </div>
      </div>
    </div>
  )
}
