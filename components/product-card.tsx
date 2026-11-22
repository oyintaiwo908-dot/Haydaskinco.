"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Star } from "lucide-react"
import {
  ProductCardAddButton,
  ProductCardFavoriteButton,
} from "@/components/product-card-actions"
import { Price } from "@/components/ui/price"
import { LinkPendingHint } from "@/components/link-pending-hint"
import { ViewTransition } from "@/components/motion/view-transition"
import { productMorphName } from "@/components/motion/morph-name"
import { getEffectivePrice, hasDiscount, productTags, type Product } from "@/lib/products"
import { cn } from "@/lib/utils"

function tagClass(tag: string) {
  return tag === "Bestseller" || tag === "Low Stock"
    ? "bg-navy text-primary-foreground"
    : "bg-blush text-navy-deep"
}

/**
 * Product card (client — used from shop filters and RSC pages alike).
 * One stretched link covers the card; the favourite and quick-add buttons sit above it
 * as siblings (no interactive element is nested inside the link).
 */
export function ProductCard({
  product,
  index,
  href,
}: {
  product: Product
  index?: number
  /** Deprecated: every product stage is white now (kept so callers need not change). */
  isWhiteBackground?: boolean
  /** Override product detail link (e.g. `/deal/[id]` for bundles). */
  href?: string
}) {
  const detailHref = href ?? `/product/${product.id}`
  const tags = productTags(product)
  const onSale = hasDiscount(product)
  const lowStock = product.stock > 0 && product.stock <= 10
  const soldOut = product.stock === 0
  const altImage = product.images?.find(src => src && src !== product.image)
  // The second photo loads on first hover only (fine pointers), never with the grid.
  const [showAlt, setShowAlt] = useState(false)
  // Named only once this card is chosen, so two cards for the same product on one page never
  // share a view-transition name; the PDP gallery carries the same name and the image morphs.
  const [morph, setMorph] = useState(false)

  return (
    <article
      className="group relative flex flex-col @container"
      data-flip-key={product.id}
      data-index={index}
      onPointerEnter={e => {
        if (altImage && e.pointerType === "mouse") setShowAlt(true)
      }}
      onClickCapture={e => {
        if ((e.target as HTMLElement).closest("a.card-link")) setMorph(true)
      }}
    >
      <ViewTransition name={morph && !href ? productMorphName(product.id) : undefined} share="product-morph" default="none">
      <div
        data-card-media=""
        className={cn(
          "card-media product-stage relative aspect-4/5 overflow-hidden",
        )}
      >
        <Image
          src={product.image || "/placeholder.svg"}
          alt=""
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className="object-cover"
        />
        {showAlt && altImage && (
          <Image src={altImage} alt="" fill sizes="(max-width: 1280px) 33vw, 25vw" className="card-alt object-cover" />
        )}
        <div className="card-spotlight" aria-hidden />
        {(tags.length > 0 || onSale) && (
          <ul className="absolute left-2 top-2 z-[2] flex flex-col items-start gap-1" aria-label="Product labels">
            {tags.map(t => (
              <li key={t} className={cn("px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", tagClass(t))}>
                {t}
              </li>
            ))}
            {onSale && (
              <li className="bg-rose px-2 py-1 font-serif text-sm leading-none text-white">
                −{product.discountPct}%
              </li>
            )}
          </ul>
        )}
      </div>
      </ViewTransition>

      <div className="flex flex-1 flex-col pt-4">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <span aria-hidden className="h-px w-4 bg-rose" />
          {product.brand}
        </p>
        <h3 className="mt-1.5 font-serif text-lg leading-snug text-navy-deep md:text-xl">
          {/* prefetch off: grids render up to 96 cards; viewport prefetch fanned out into CDN hits and ISR regenerations on Vercel (CPU budget). */}
          <Link
            href={detailHref}
            prefetch={false}
            className="card-link line-clamp-2 after:absolute after:inset-0 after:z-[1] after:content-['']"
          >
            {product.name}
            {/* Feedback while the (non-prefetched) product page loads */}
            <LinkPendingHint />
          </Link>
        </h3>
        {/* After the title in reading order; positioned over the image (see product-card-actions). */}
        <ProductCardFavoriteButton product={product} />
        <ProductCardAddButton product={product} />
        {product.tagline && (
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{product.tagline}</p>
        )}

        {product.reviewCount > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5" aria-hidden>
              {[1, 2, 3, 4, 5].map(i => (
                <Star
                  key={i}
                  className={cn("size-3", product.rating >= i - 0.25 ? "fill-navy text-navy" : "fill-transparent text-navy/60")}
                />
              ))}
            </span>
            <span className="sr-only">
              Rated {product.rating.toFixed(1)} out of 5 from {product.reviewCount} reviews
            </span>
            <span aria-hidden className="tabular-nums">
              {product.rating.toFixed(1)} ({product.reviewCount})
            </span>
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-3">
          <Price amount={getEffectivePrice(product)} compareAt={onSale ? product.price : null} size="sm" className="font-serif text-lg md:text-xl" />
          {lowStock && <span className="text-xs font-medium text-warning">Low stock</span>}
          {soldOut && <span className="text-xs font-medium text-destructive">Out of stock</span>}
        </div>
      </div>
    </article>
  )
}
