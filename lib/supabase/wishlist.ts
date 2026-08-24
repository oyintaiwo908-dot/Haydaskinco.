import { createClient } from "@/lib/supabase/client"
import type { Product } from "@/lib/products"
import { getProductsByIds } from "@/lib/supabase/products"
import { bareDealId, dealAsProduct, isDealCartId } from "@/lib/deals"
import { getDealById } from "@/lib/supabase/deals"

/**
 * Fetch wishlist without PostgREST embeds.
 * Migration 020 dropped wishlist→products FK so deal__* ids can be stored;
 * nested `products(...)` selects therefore fail schema-cache lookups.
 */
export async function fetchWishlistProducts(): Promise<Product[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: rows, error } = await supabase
    .from("wishlist")
    .select("product_id")
    .eq("user_id", user.id)
    .order("added_at", { ascending: false })

  if (error) {
    console.error("[wishlist] fetch:", error.message)
    return []
  }

  const ids = (rows ?? [])
    .map(r => String((r as { product_id?: string }).product_id ?? ""))
    .filter(Boolean)

  const productIds = [...new Set(ids.filter(id => !isDealCartId(id)))]
  const dealCartIds = [...new Set(ids.filter(isDealCartId))]

  const [products, deals] = await Promise.all([
    getProductsByIds(productIds),
    Promise.all(
      dealCartIds.map(async id => {
        const deal = await getDealById(bareDealId(id))
        return deal && deal.status === "active" ? { cartId: id, product: dealAsProduct(deal) } : null
      }),
    ),
  ])

  const byId = new Map<string, Product>(products.map(p => [p.id, p]))
  for (const entry of deals) {
    if (entry) byId.set(entry.cartId, entry.product)
  }

  return ids.map(id => byId.get(id)).filter((p): p is Product => Boolean(p))
}

export async function addToWishlist(productId: string): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return "Supabase not configured."

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return "Sign in to save favourites."

  const { error } = await supabase
    .from("wishlist")
    .upsert({ user_id: user.id, product_id: productId }, { onConflict: "user_id,product_id" })

  return error?.message ?? null
}

export async function removeFromWishlist(productId: string): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return "Supabase not configured."

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return "Sign in required."

  const { error } = await supabase
    .from("wishlist")
    .delete()
    .eq("user_id", user.id)
    .eq("product_id", productId)

  return error?.message ?? null
}
