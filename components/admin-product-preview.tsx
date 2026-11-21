import { getEffectivePrice, hasDiscount } from "@/lib/products"
import { Price } from "@/components/ui/price"
import { cn } from "@/lib/utils"

/**
 * Static storefront card for the product editor.
 * Mirrors components/product-card.tsx (porcelain stage, photo filling the 4:5 frame,
 * left-aligned brand, serif name, naira price) without cart or favourites providers.
 */
export function AdminProductPreview({
  name,
  brand,
  tagline,
  price,
  discountPct,
  imageSrc,
  className,
}: {
  name: string
  brand: string
  tagline: string
  price: string
  discountPct: string
  imageSrc?: string
  className?: string
}) {
  const priceNum = Number(price)
  const discount = Math.min(100, Math.max(0, parseInt(discountPct, 10) || 0))
  const hasPrice = price.trim() !== "" && Number.isFinite(priceNum) && priceNum > 0
  const priced = { price: hasPrice ? priceNum : 0, discountPct: discount }
  const showDiscount = hasPrice && hasDiscount(priced)
  const displayName = name.trim()
  const displayBrand = brand.trim()
  const displayTagline = tagline.trim()
  const image = imageSrc?.trim()

  return (
    <section aria-label="Storefront card preview" className={cn("border border-border p-6", className)}>
      <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.18em]">Storefront preview</h2>
      <article className="mx-auto flex w-full max-w-[240px] flex-col">
        <div className="relative aspect-4/5 overflow-hidden bg-porcelain">
          {showDiscount && (
            <span className="absolute left-2 top-2 z-10 bg-rose px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white">
              −{discount}%
            </span>
          )}
          {image ? (
            // Plain img so unsaved blob: previews render.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={displayName || "Product image"} className="absolute inset-0 size-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs uppercase tracking-[0.16em] text-muted-foreground">
              No image
            </div>
          )}
        </div>

        <div className="flex flex-col pt-3">
          <p
            className={cn(
              "text-[11px] font-medium uppercase tracking-[0.16em]",
              displayBrand ? "text-muted-foreground" : "text-muted-foreground/60",
            )}
          >
            {displayBrand || "Brand"}
          </p>
          <h3
            className={cn(
              "mt-1.5 line-clamp-2 font-serif text-lg leading-snug",
              displayName ? "text-navy-deep" : "text-muted-foreground/60",
            )}
          >
            {displayName || "Product name"}
          </h3>
          <p className={cn("mt-1 line-clamp-1 text-sm", displayTagline ? "text-muted-foreground" : "text-muted-foreground/60")}>
            {displayTagline || "Tagline"}
          </p>
          <div className="mt-2">
            {hasPrice ? (
              <Price amount={getEffectivePrice(priced)} compareAt={showDiscount ? priceNum : null} size="sm" />
            ) : (
              <p className="text-sm text-muted-foreground/60">₦—</p>
            )}
          </div>
        </div>
      </article>
    </section>
  )
}
