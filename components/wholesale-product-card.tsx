"use client"

import Image from "next/image"
import Link from "next/link"
import {
  calculateUnitPrice,
  getEffectivePrice,
  normalizePriceTiers,
  type Product,
} from "@/lib/products"
import { Money, Price } from "@/components/ui/price"

/** Wholesale card: tier pricing first. One stretched link covers the card. */
export function WholesaleProductCard({
  product,
}: {
  product: Product
  index?: number
}) {
  const tiers = normalizePriceTiers(product.priceTiers, product.price)
  const listPrice = getEffectivePrice(product)
  const title = product.size ? `${product.name} ${product.size}` : product.name

  return (
    <article className="group relative flex flex-col border border-border bg-background transition-colors duration-200 hover:border-navy/40">
      <div className="relative aspect-square overflow-hidden bg-porcelain">
        <Image
          src={product.image || "/placeholder.svg"}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-700 ease-atelier group-hover:scale-[1.04]"
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{product.brand}</p>
        <h3 className="mt-1 font-serif text-lg leading-snug text-navy-deep">
          {/* prefetch off: grids render up to 96 cards; viewport prefetch fanned out into CDN hits and ISR regenerations on Vercel (CPU budget). */}
          <Link
            href={`/product/${product.id}`}
            prefetch={false}
            className="card-link after:absolute after:inset-0 after:content-['']"
          >
            {title}
          </Link>
        </h3>
        {tiers.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-foreground">
            {tiers.map(tier => {
              const unit = calculateUnitPrice({
                basePrice: product.price,
                skuPrice: product.price,
                quantity: tier.qty,
                priceTiers: product.priceTiers,
                discountPct: product.discountPct,
              })
              return (
                <li key={tier.qty} className="flex justify-between gap-2 tabular-nums">
                  <span>{tier.qty}+ pcs</span>
                  <span className="font-medium"><Money amount={unit} /> each</span>
                </li>
              )
            })}
          </ul>
        )}
        <div className="mt-auto pt-3">
          <Price amount={listPrice} compareAt={listPrice < product.price ? product.price : null} size="sm" />
        </div>
      </div>
    </article>
  )
}
