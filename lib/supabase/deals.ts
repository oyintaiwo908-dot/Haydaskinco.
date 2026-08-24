/**
 * Deals / Bundles query helpers.
 * Falls back to the static mock array ONLY when Supabase is not configured.
 */
import { createClient as createSb } from "@supabase/supabase-js"
import { createClient, createAdminBrowserClient } from "@/lib/supabase/client"
import type { Deal, DealItem } from "@/lib/deals"
import { deals as mockDeals } from "@/lib/deals"
import { getEffectivePrice } from "@/lib/products"

function getStorefrontReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (typeof window !== "undefined") return createClient()
  return createSb(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItems(raw: unknown): DealItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((i: Record<string, unknown>) => ({
    productId: String(i.productId ?? i.product_id ?? ""),
    variantLabel: (i.variantLabel ?? i.variant_label ?? null) as string | null,
    name: String(i.name ?? ""),
    size: String(i.size ?? i.variantLabel ?? i.variant_label ?? ""),
    price: Number(i.price ?? 0),
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToDeal(row: any): Deal {
  const items = mapItems(row.items)
  const originalPrice = Number(row.original_price ?? 0) || items.reduce((s, i) => s + i.price, 0)
  const discountPct = Math.min(100, Math.max(0, Number(row.discount_pct ?? 0)))
  let salePrice = Number(row.price ?? 0)
  if (discountPct > 0) {
    salePrice = getEffectivePrice({ price: originalPrice, discountPct })
  } else if (!salePrice) {
    salePrice = originalPrice
  }

  const concerns: string[] = Array.isArray(row.concerns)
    ? row.concerns.filter(Boolean)
    : typeof row.description === "string" && row.description.includes("·")
      ? row.description.split(/\s*·\s*/).filter(Boolean)
      : []

  // Prefer real description; if legacy row stored concerns in description, leave empty
  const legacyConcernsInDescription =
    typeof row.description === "string" &&
    row.description.includes("·") &&
    (!Array.isArray(row.concerns) || row.concerns.length === 0)
  const description = legacyConcernsInDescription ? "" : (row.description ?? "")

  const brandIds: string[] = Array.isArray(row.brand_ids) ? row.brand_ids.filter(Boolean) : []
  const brand = String(row.brand_name || "").trim()
    || (brandIds.length ? brandIds.join(", ") : "")

  const badge =
    row.tag ||
    (discountPct > 0 ? `Save ${discountPct}%` : "") ||
    (originalPrice > salePrice && originalPrice > 0
      ? `Save ${Math.round((1 - salePrice / originalPrice) * 100)}%`
      : "")

  return {
    id: String(row.id),
    title: row.title,
    subtitle: row.tagline ?? "",
    description,
    image: row.image_url || "/product-bundle.png",
    brand,
    brandIds,
    badge,
    concerns,
    concern: concerns.join(" · "),
    originalPrice,
    discountPct,
    salePrice,
    items,
    highlight: Boolean(row.highlight),
    status: row.is_active ? "active" : "draft",
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    createdAt: row.created_at
      ? String(row.created_at).slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  }
}

export type SaveDealInput = {
  id?: string
  title: string
  subtitle: string
  description: string
  image: string
  brand: string
  brandIds: string[]
  badge?: string
  concerns: string[]
  items: DealItem[]
  discountPct: number
  highlight?: boolean
  status: "active" | "draft" | "archived"
}

export async function getAllDeals(): Promise<Deal[]> {
  const supabase = createAdminBrowserClient()
  if (!supabase) return mockDeals

  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[deals] getAllDeals:", error.message)
    return []
  }
  return (data ?? []).map(rowToDeal)
}

export async function getActiveDeals(): Promise<Deal[]> {
  const supabase = getStorefrontReadClient()
  if (!supabase) return mockDeals.filter(d => d.status === "active")

  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[deals] getActiveDeals:", error.message)
    return []
  }
  return (data ?? []).map(rowToDeal)
}

export async function getDealById(id: string): Promise<Deal | null> {
  const supabase = createAdminBrowserClient() ?? createClient()
  if (!supabase) return mockDeals.find(d => d.id === id) ?? null

  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[deals] getDealById:", error.message, "id=", id)
    return null
  }
  if (!data) return null
  return rowToDeal(data)
}

/** Active deal ids for static generation. */
export async function getDealIds(): Promise<string[]> {
  const supabase = createClient()
  if (!supabase) return mockDeals.filter(d => d.status === "active").map(d => d.id)

  const { data, error } = await supabase
    .from("deals")
    .select("id")
    .eq("is_active", true)

  if (error) {
    console.error("[deals] getDealIds:", error.message)
    return []
  }
  return (data ?? []).map(r => String(r.id))
}

/** Upsert a deal. Returns the saved id. */
export async function saveDeal(
  values: SaveDealInput,
  existingId?: string,
): Promise<string> {
  const supabase = createAdminBrowserClient()
  if (!supabase) {
    console.warn("Supabase not configured — deal not persisted.")
    return existingId ?? values.id ?? "mock-" + Date.now()
  }

  const id =
    existingId ??
    values.id ??
    values.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

  const originalPrice = values.items.reduce((s, i) => s + Number(i.price || 0), 0)
  const discountPct = Math.min(100, Math.max(0, Number(values.discountPct) || 0))
  const salePrice = getEffectivePrice({ price: originalPrice, discountPct })
  const badge =
    values.badge?.trim() ||
    (discountPct > 0 ? `Save ${discountPct}%` : "")

  const row = {
    title: values.title,
    tagline: values.subtitle,
    description: values.description || null,
    image_url: values.image || null,
    brand_name: values.brand,
    brand_ids: values.brandIds,
    tag: badge || null,
    concerns: values.concerns,
    price: salePrice,
    original_price: originalPrice,
    discount_pct: discountPct,
    items: values.items,
    is_active: values.status === "active",
    highlight: values.highlight ?? false,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = existingId
    ? await supabase.from("deals").update(row).eq("id", existingId).select("id").single()
    : await supabase.from("deals").insert({ ...row, id }).select("id").single()

  if (error) throw new Error(error.message)
  return data.id
}

export async function deleteDeal(id: string): Promise<void> {
  const supabase = createAdminBrowserClient()
  if (!supabase) return
  const { error } = await supabase.from("deals").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function toggleDealStatus(id: string, isActive: boolean): Promise<void> {
  const supabase = createAdminBrowserClient()
  if (!supabase) return
  const { error } = await supabase.from("deals").update({ is_active: isActive }).eq("id", id)
  if (error) throw new Error(error.message)
}
