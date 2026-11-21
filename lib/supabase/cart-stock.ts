/**
 * Live stock checks for cart / checkout.
 * Cart snapshots can go stale — always re-read products.stock before checkout.
 * Deal lines expand to component SKUs (min available across components).
 */
import { createClient as createSb } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { isMissingArchiveColumn, markArchiveColumnMissing } from "@/lib/supabase/archive-column"
import { bareDealId, isDealCartId } from "@/lib/deals"
import { products as mockProducts } from "@/lib/products"

export type StockAvailability = {
  productId: string
  stock: number
  /** Product missing, unpublished, or stock 0 */
  unavailable: boolean
  /** Requested qty exceeds current stock (but stock > 0) */
  exceeds: boolean
  available: number
}

function getReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (typeof window !== "undefined") return createClient()
  return createSb(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Fetch live stock keyed by cart line id (product id or deal__*). */
export async function fetchLiveStock(
  productIds: string[],
): Promise<Record<string, { stock: number; published: boolean }>> {
  const ids = [...new Set(productIds.filter(Boolean))]
  if (!ids.length) return {}

  const supabase = getReadClient()
  // Mock mode (no Supabase configured: local development and the e2e suite) answers from the
  // mock catalogue, the same data the mock product pages show. Without this every cart line
  // looked unavailable and checkout could never proceed. Never runs when Supabase is set.
  if (!supabase) {
    const map: Record<string, { stock: number; published: boolean }> = {}
    for (const id of ids) {
      const product = mockProducts.find(p => p.id === id)
      if (product) map[id] = { stock: product.stock, published: true }
    }
    return map
  }

  const plainIds = ids.filter(id => !isDealCartId(id))
  const dealCartIds = ids.filter(isDealCartId)
  const dealBareIds = dealCartIds.map(bareDealId)

  const dealsRes = dealBareIds.length
    ? await supabase.from("deals").select("id, items, is_active").in("id", dealBareIds)
    : { data: [] as { id: string; items: unknown; is_active: boolean | null }[], error: null }

  if (dealsRes.error) {
    console.error("[stock] deals:", dealsRes.error.message)
  }

  const dealByBare = new Map(
    (dealsRes.data ?? []).map(d => [String(d.id), d]),
  )

  const componentIds: string[] = []
  for (const d of dealByBare.values()) {
    if (!Array.isArray(d.items)) continue
    for (const di of d.items as { productId?: string }[]) {
      if (di.productId) componentIds.push(String(di.productId))
    }
  }

  const allProductIds = [...new Set([...plainIds, ...componentIds])]
  const map: Record<string, { stock: number; published: boolean }> = {}

  if (allProductIds.length) {
    let { data, error } = await supabase
      .from("products")
      .select("id, stock, is_published, is_archived")
      .in("id", allProductIds)

    if (error && isMissingArchiveColumn(error.message)) {
      markArchiveColumnMissing()
      const retry = await supabase
        .from("products")
        .select("id, stock, is_published")
        .in("id", allProductIds)
      data = retry.data
      error = retry.error
    }

    if (error) {
      console.error("[stock] fetchLiveStock:", error.message)
      return {}
    }

    for (const row of data ?? []) {
      map[row.id] = {
        stock: Number(row.stock) || 0,
        published: row.is_published !== false && row.is_archived !== true,
      }
    }
  }

  // Expose deal cart ids as the bottleneck component stock
  for (const cartId of dealCartIds) {
    const deal = dealByBare.get(bareDealId(cartId))
    if (!deal || deal.is_active === false || !Array.isArray(deal.items) || !deal.items.length) {
      map[cartId] = { stock: 0, published: false }
      continue
    }
    let minStock = Number.POSITIVE_INFINITY
    let published = true
    for (const di of deal.items as { productId?: string; qty?: number }[]) {
      const cid = di.productId ? String(di.productId) : ""
      if (!cid) {
        published = false
        minStock = 0
        break
      }
      const prow = map[cid]
      if (!prow || !prow.published) {
        published = false
        minStock = 0
        break
      }
      const perBundle = Math.max(1, Math.floor(Number(di.qty) || 1))
      const bundles = Math.floor(prow.stock / perBundle)
      minStock = Math.min(minStock, bundles)
    }
    map[cartId] = {
      stock: Number.isFinite(minStock) ? minStock : 0,
      published,
    }
  }

  return map
}

export function evaluateCartStock(
  items: { id: string; quantity: number }[],
  live: Record<string, { stock: number; published: boolean }>,
): StockAvailability[] {
  return items.map(i => {
    const row = live[i.id]
    if (!row || !row.published || row.stock <= 0) {
      return {
        productId: i.id,
        stock: row?.stock ?? 0,
        available: 0,
        unavailable: true,
        exceeds: false,
      }
    }
    const exceeds = i.quantity > row.stock
    return {
      productId: i.id,
      stock: row.stock,
      available: row.stock,
      unavailable: false,
      exceeds,
    }
  })
}

export function hasBlockingStockIssues(issues: StockAvailability[]): boolean {
  return issues.some(i => i.unavailable || i.exceeds)
}
