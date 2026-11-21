"use client"

import { useRef, useState, type CSSProperties } from "react"
import { Check, Plus, Heart } from "lucide-react"
import { useCart } from "@/components/cart-provider"
import { useFavorites } from "@/components/favorites-provider"
import { announce, flyToBag } from "@/components/motion/fly-to-bag"
import type { Product } from "@/lib/products"
import { cn } from "@/lib/utils"

/** Visible on touch; on hover-capable pointers it appears on hover or keyboard focus. */
const revealOnHover =
  "[@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-100"

/**
 * Client islands for ProductCard. Siblings of the card link (never nested inside it) and placed
 * after the title in DOM order; both are positioned over the 4:5 image: the card is a size
 * container, so the image height is 125cqw.
 */
export function ProductCardFavoriteButton({ product }: { product: Product }) {
  const { isFavorited, toggleFavorite } = useFavorites()
  const favorited = isFavorited(product.id)
  // Bumps on each save so the burst replays (keyed remount).
  const [burst, setBurst] = useState(0)

  return (
    <button
      type="button"
      onClick={() => {
        toggleFavorite(product)
        if (!favorited) setBurst(b => b + 1)
        announce(favorited ? `Removed ${product.name} from favourites` : `Saved ${product.name} to favourites`)
      }}
      aria-label={`Save ${product.name} to favourites`}
      aria-pressed={favorited}
      className={cn(
        "absolute right-2 top-2 z-[3] flex size-11 items-center justify-center rounded-full transition-[opacity,color,background-color] duration-200 ease-atelier",
        favorited ? "text-rose" : cn("text-navy hover:text-rose", revealOnHover),
      )}
    >
      <span className="relative flex size-9 items-center justify-center rounded-full bg-white/90 shadow-sm">
        <Heart key={burst} aria-hidden className={cn("size-4", favorited && "fill-current", burst > 0 && "heart-pop")} strokeWidth={1.5} />
        {burst > 0 && (
          <span key={`b${burst}`} className="heart-burst" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <i key={i} style={{ "--i": i } as CSSProperties} />
            ))}
          </span>
        )}
      </span>
    </button>
  )
}

export function ProductCardAddButton({ product }: { product: Product }) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const soldOut = product.stock === 0

  return (
    <button
      ref={ref}
      type="button"
      disabled={soldOut}
      onClick={() => {
        addItem(product)
        flyToBag((ref.current?.closest("article")?.querySelector("[data-card-media]") ?? null) as HTMLElement | null)
        announce(`Added ${product.name} to cart`)
        setAdded(true)
        window.setTimeout(() => setAdded(false), 1600)
      }}
      aria-label={soldOut ? `${product.name} is out of stock` : `Add ${product.name} to cart`}
      data-added={added || undefined}
      className={cn(
        "card-quick absolute right-2 top-[calc(125cqw-3.25rem)] z-[3] flex size-11 items-center justify-center rounded-control border shadow-sm active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-0",
        added
          ? "border-navy bg-navy text-primary-foreground"
          : "border-navy/15 bg-white text-navy hover:border-navy hover:bg-navy hover:text-primary-foreground",
      )}
    >
      {added ? <Check aria-hidden className="size-5" /> : <Plus aria-hidden className="size-5" strokeWidth={1.5} />}
    </button>
  )
}
