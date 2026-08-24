import type { Product } from "@/lib/products"
import { getEffectivePrice } from "@/lib/products"

export type DealItem = {
  productId: string
  /** Selected variant label when the product has variants */
  variantLabel?: string | null
  name: string
  size: string
  price: number
}

export type Deal = {
  id: string
  badge: string
  /** Display string — joined brand names */
  brand: string
  brandIds: string[]
  title: string
  subtitle: string
  description: string
  image: string
  items: DealItem[]
  /** Sum of selected product/variant prices (list price) */
  originalPrice: number
  discountPct: number
  /** List price after discount — derived for convenience */
  salePrice: number
  concerns: string[]
  /** @deprecated use concerns — kept for older call sites during migration */
  concern?: string
  highlight?: boolean
  status: "active" | "draft" | "archived"
  rating: number
  reviewCount: number
  createdAt: string
}

/** Cart / wishlist / review id for a deal. */
export function dealCartId(dealId: string): string {
  return dealId.startsWith("deal__") ? dealId : `deal__${dealId}`
}

export function bareDealId(id: string): string {
  return id.startsWith("deal__") ? id.slice(6) : id
}

export function isDealCartId(id: string): boolean {
  return id.startsWith("deal__")
}

export function dealSalePrice(deal: Pick<Deal, "originalPrice" | "discountPct" | "salePrice">): number {
  if (deal.discountPct > 0) {
    return getEffectivePrice({ price: deal.originalPrice, discountPct: deal.discountPct })
  }
  return deal.salePrice || deal.originalPrice
}

/**
 * Converts a deal into a Product-shaped object so it can use cart,
 * wishlist, ProductDetail, and reviews without separate providers.
 */
export function dealAsProduct(deal: Deal): Product {
  const listPrice = deal.originalPrice || deal.items.reduce((s, i) => s + i.price, 0)
  const pct = Math.min(100, Math.max(0, deal.discountPct || 0))
  const badgePct =
    pct > 0
      ? pct
      : listPrice > 0 && deal.salePrice > 0 && deal.salePrice < listPrice
        ? Math.round((1 - deal.salePrice / listPrice) * 100)
        : 0

  return {
    id: dealCartId(deal.id),
    name: deal.title,
    brand: deal.brand,
    tagline: deal.subtitle,
    description: deal.description || deal.subtitle,
    price: listPrice,
    discountPct: badgePct || undefined,
    image: deal.image || "/product-bundle.png",
    images: deal.image ? [deal.image] : ["/product-bundle.png"],
    category: "bundle",
    tag: (() => {
      const badge = deal.badge?.trim()
      const allowed = ["Bestseller", "New", "Sale", "Low Stock"] as const
      if (badge && (allowed as readonly string[]).includes(badge)) {
        return badge as (typeof allowed)[number]
      }
      return "Sale"
    })(),
    benefits: deal.items.map(i =>
      i.variantLabel || i.size ? `${i.name} (${i.variantLabel || i.size})` : i.name,
    ),
    ingredients: [],
    concerns: deal.concerns?.length
      ? deal.concerns
      : deal.concern
        ? deal.concern.split(/\s*·\s*/).filter(Boolean)
        : [],
    stock: 99,
    rating: deal.rating || 0,
    reviewCount: deal.reviewCount || 0,
  }
}

/** Static fallback when Supabase is not configured. */
export const deals: Deal[] = [
  {
    id: "barrier-repair",
    badge: "Save 17%",
    brand: "CeraVe",
    brandIds: ["cerave"],
    title: "Barrier Repair Bundle",
    subtitle: "Complete daily routine for dry & sensitive skin",
    description:
      "A dermatologist-recommended trio to cleanse, moisturise, and care for the eye area — ideal for dry and sensitive skin.",
    image: "/product-bundle.png",
    items: [
      { productId: "cerave-hydrating-cleanser", name: "Hydrating Facial Cleanser", size: "237ml", price: 5500 },
      { productId: "cerave-moisturising-cream", name: "Moisturising Cream", size: "454g", price: 8900 },
      { productId: "cerave-eye-repair", name: "Eye Repair Cream", size: "14.2g", price: 7200 },
    ],
    originalPrice: 21600,
    discountPct: 17,
    salePrice: 18000,
    concerns: ["Dry Skin", "Sensitive Skin"],
    highlight: true,
    status: "active",
    rating: 4.8,
    reviewCount: 0,
    createdAt: "2024-11-01",
  },
]

export function getDeal(id: string) {
  return deals.find(d => d.id === id)
}
