"use client"

import Image from "next/image"
import Link from "next/link"
import { Star } from "lucide-react"
import {
  ProductCardAddButton,
  ProductCardFavoriteButton,
} from "@/components/product-card-actions"
import { formatPrice, getEffectivePrice, hasDiscount, productTags, type Product } from "@/lib/products"
import { cn } from "@/lib/utils"

function tagClass(tag: string) {
  return tag === "Bestseller" || tag === "Low Stock"
    ? "bg-gold text-gold-foreground"
    : "bg-accent text-accent-foreground"
}

/**
 * Product card (client — used from shop filters and RSC pages alike).
 * Cart / favorite interactions live in product-card-actions.
 */
export function ProductCard({
  product,
  index = 0,
  isWhiteBackground = false,
  href,
}: {
  product: Product
  index?: number
  isWhiteBackground?: boolean
  /** Override product detail link (e.g. `/deal/[id]` for bundles). */
  href?: string
}) {
  const detailHref = href ?? `/product/${product.id}`
  const tags = productTags(product)

  return (
    <article className="group flex flex-col" style={{ animationDelay: `${index * 90}ms` }}>
      <Link
        href={detailHref}
        aria-label={`View ${product.name}`}
        className={cn(
          "relative aspect-4/5 overflow-hidden border border-border transition-colors duration-500 group-hover:border-gold/60",
          isWhiteBackground && "bg-white",
        )}
      >
        {tags.length > 0 && (
          <div className="absolute left-4 top-4 z-10 flex flex-col gap-1.5 items-start">
            {tags.map(t => (
              <span
                key={t}
                className={cn(
                  "px-3 py-1 text-[8px] md:text-[10px] font-medium uppercase tracking-[0.18em]",
                  tagClass(t),
                )}
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {hasDiscount(product) && (
          <span
            className="absolute left-4 z-10 px-3 py-1 text-[8px] md:text-[10px] font-medium uppercase tracking-[0.18em] bg-foreground text-background"
            style={{ top: tags.length ? `${1 + tags.length * 1.75}rem` : "1rem" }}
          >
            -{product.discountPct}%
          </span>
        )}

        <ProductCardFavoriteButton product={product} />

        <Image
          src={product.image || "/placeholder.svg"}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-contain mix-blend-multiply transition-transform duration-700 ease-out group-hover:scale-105"
        />

        <ProductCardAddButton product={product} />
      </Link>

      <div className="flex flex-1 flex-col items-center px-1 pt-5 text-center">
        <p className="text-[8px] md:text-[10px] font-light uppercase tracking-[0.22em] text-gold">{product.brand}</p>
        <h3 className="mt-2 font-serif text-lg md:text-xl font-medium leading-snug text-foreground">
          <Link href={detailHref} className="transition-colors hover:text-gold line-clamp-2">
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 text-[10px] md:text-xs font-light text-muted-foreground line-clamp-2">{product.tagline}</p>

        {product.reviewCount > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(i => (
                <Star
                  key={i}
                  className={cn(
                    "size-3",
                    product.rating >= i ? "fill-gold text-gold" : "fill-muted text-border",
                  )}
                />
              ))}
            </div>
            <span className="text-[10px] font-light text-muted-foreground">({product.reviewCount})</span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {hasDiscount(product) ? (
            <>
              <p className="text-sm font-light tracking-wide text-muted-foreground line-through">
                {formatPrice(product.price)}
              </p>
              <p className="text-sm font-medium tracking-wide text-foreground">
                {formatPrice(getEffectivePrice(product))}
              </p>
            </>
          ) : (
            <p className="text-sm font-light tracking-wide text-foreground">{formatPrice(product.price)}</p>
          )}
          {product.stock <= 10 && product.stock > 0 && (
            <span className="text-[10px] font-light text-amber-600">Low stock</span>
          )}
          {product.stock === 0 && (
            <span className="text-[10px] font-light text-destructive">Out of stock</span>
          )}
        </div>
      </div>
    </article>
  )
}
