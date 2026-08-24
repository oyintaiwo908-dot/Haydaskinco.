import { createClient } from "@/lib/supabase/client"

export type PointsEntry = {
  id: string
  type: "earn" | "redeem"
  label: string
  points: number
  date: string
}

export type RewardsSummary = {
  balance: number
  history: PointsEntry[]
  tier: string
  nextTier: string
  nextTierAt: number
}

export type PendingRewardPromo = {
  code: string
  discountNgn: number
  rewardId: string
  label: string
}

const TIERS = [
  { label: "Bronze", min: 0 },
  { label: "Silver", min: 500 },
  { label: "Gold", min: 2000 },
  { label: "Platinum", min: 5000 },
]

function tierFor(balance: number) {
  let current = TIERS[0]
  let next = TIERS[1]
  for (let i = 0; i < TIERS.length; i++) {
    if (balance >= TIERS[i].min) {
      current = TIERS[i]
      next = TIERS[i + 1] ?? TIERS[i]
    }
  }
  return {
    tier: current.label,
    nextTier: next.label === current.label ? current.label : next.label,
    nextTierAt: next.label === current.label ? current.min : next.min,
  }
}

export const REWARD_CATALOG = [
  { id: "r1", label: "₦500 off your next order", cost: 500, discountNgn: 500 },
  { id: "r2", label: "₦1,000 off your next order", cost: 1000, discountNgn: 1000 },
  { id: "r3", label: "₦250 off (free delivery credit)", cost: 250, discountNgn: 250 },
  { id: "r4", label: "₦2,000 off your next order", cost: 2000, discountNgn: 2000 },
  { id: "r5", label: "₦800 off your next order", cost: 800, discountNgn: 800 },
  { id: "r6", label: "₦1,500 off your next order", cost: 1500, discountNgn: 1500 },
] as const

export async function getRewardsSummary(): Promise<RewardsSummary | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("points_ledger")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[rewards] ledger:", error.message)
    return { balance: 0, history: [], ...tierFor(0) }
  }

  const rows = data ?? []
  const balance = rows.reduce((s, r) => s + Number(r.delta), 0)
  const history: PointsEntry[] = rows.map(r => ({
    id: r.id,
    type: Number(r.delta) >= 0 ? "earn" : "redeem",
    label: r.label,
    points: Number(r.delta),
    date: new Date(r.created_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  }))

  return { balance, history, ...tierFor(balance) }
}

/**
 * Most recent unused reward promo for the signed-in user
 * (created via redeem on Rewards page or checkout).
 */
export async function getPendingRewardPromo(): Promise<PendingRewardPromo | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("reward_redemptions")
    .select("promo_code, reward_id, points_spent")
    .eq("user_id", user.id)
    .order("redeemed_at", { ascending: false })

  if (error) {
    console.error("[rewards] pending:", error.message)
    return null
  }

  const rows = (data ?? []).filter(r => r.promo_code)
  if (!rows.length) return null

  const codes = [...new Set(rows.map(r => String(r.promo_code)))]
  const { data: promos } = await supabase
    .from("promo_codes")
    .select("code, discount_ngn, max_uses, used_count, is_active")
    .in("code", codes)

  const promoByCode = new Map(
    (promos ?? []).map(p => [String(p.code), p]),
  )

  for (const row of rows) {
    const promo = promoByCode.get(String(row.promo_code))
    if (!promo || !promo.is_active) continue
    if (promo.max_uses != null && promo.used_count >= promo.max_uses) continue

    const catalog = REWARD_CATALOG.find(r => r.id === row.reward_id)
    return {
      code: promo.code,
      discountNgn: Number(promo.discount_ngn) || catalog?.discountNgn || 0,
      rewardId: row.reward_id,
      label: catalog?.label ?? `₦${Number(promo.discount_ngn || 0).toLocaleString()} rewards credit`,
    }
  }

  return null
}

export async function redeemReward(rewardId: string): Promise<{
  ok: boolean
  message?: string
  promoCode?: string
  discountNgn?: number
}> {
  const reward = REWARD_CATALOG.find(r => r.id === rewardId)
  if (!reward) return { ok: false, message: "Unknown reward." }

  const supabase = createClient()
  if (!supabase) return { ok: false, message: "Supabase not configured." }

  const { data, error } = await supabase.rpc("redeem_reward", {
    p_reward_id: reward.id,
    p_points_cost: reward.cost,
    p_discount_ngn: reward.discountNgn,
    p_label: reward.label,
  })

  if (error) return { ok: false, message: error.message }
  if (data && typeof data === "object") {
    const d = data as { ok?: boolean; message?: string; promo_code?: string; discount_ngn?: number }
    return {
      ok: Boolean(d.ok),
      message: d.message,
      promoCode: d.promo_code,
      discountNgn: d.discount_ngn,
    }
  }
  return { ok: false, message: "Redeem failed." }
}
