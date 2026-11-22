"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import {
  Check, Minus, Plus, ChevronLeft, ChevronRight, Heart, Star,
  Truck, ShieldCheck, RotateCcw, CircleCheck, CircleAlert, CircleX,
} from "lucide-react"
import { useCart } from "@/components/cart-provider"
import { useFavorites } from "@/components/favorites-provider"
import { PdpGallery } from "@/components/pdp-gallery"
import { productMorphName } from "@/components/motion/morph-name"
import { StickyBuyBar } from "@/components/sticky-buy-bar"
import { Money, Price } from "@/components/ui/price"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { Disclosure } from "@/components/ui/disclosure"
import { announce, flyToBag } from "@/components/motion/fly-to-bag"
import {
  buildPriceBands,
  calculateTotalPrice,
  calculateUnitPrice,
  getEffectivePrice,
  getProductMoq,
  getTierDiscount,
  hasDiscount,
  productTags,
  type Product,
} from "@/lib/products"
import { isDealCartId } from "@/lib/deals"
import { slugifyCategory } from "@/lib/supabase/categories"
import { ALL_CONCERNS, ALL_INGREDIENTS, slugifyCatalogLabel } from "@/lib/catalog"
import { DELIVERY_NOTE } from "@/lib/storefront-copy"
import { cn } from "@/lib/utils"

const PINNED_CONCERNS = new Set<string>(ALL_CONCERNS)
const PDP_SUMMARY = "min-h-16 font-serif text-2xl font-normal normal-case tracking-normal text-navy-deep"
const PINNED_INGREDIENTS = new Set<string>(ALL_INGREDIENTS)

/** Concern/ingredient pages are prebuilt for the pinned catalogue only; custom values are shown as text. */
function CatalogChip({ label, href, linked }: { label: string; href: string; linked: boolean }) {
  const cls = "inline-flex min-h-9 items-center rounded-control border px-3 text-sm"
  return linked ? (
    <Link href={href} prefetch={false} className={cn(cls, "border-navy/20 text-navy-deep transition-colors hover:border-navy hover:bg-porcelain")}>
      {label}
    </Link>
  ) : (
    <span className={cn(cls, "border-border text-foreground")}>{label}</span>
  )
}

export function ProductDetail({ product, hideBenefits = false }: { product: Product, hideBenefits?: boolean }) {
  const { addItem } = useCart()
  const { isFavorited, toggleFavorite } = useFavorites()
  const ctaRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)

  const gallery = product.images && product.images.length > 0 ? product.images : [product.image]
  const isDeal = isDealCartId(product.id) || product.category === "bundle"
  const moq = isDealCartId(product.id) ? 1 : getProductMoq(product)
  const basePrice = product.price
  const [qty, setQty] = useState(moq)
  const [added, setAdded] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState(
    product.variants && product.variants.length > 0 ? 0 : null
  )
  const favorited = isFavorited(product.id)
  /** Present on records that have it (products.how_to_use); not part of the shared type yet. */
  const howToUse = (product as Product & { howToUse?: string }).howToUse?.trim()

  // Absolute SKU price; delta vs base is applied inside calculateUnitPrice
  const skuPrice =
    selectedVariant !== null && product.variants
      ? product.variants[selectedVariant].price
      : basePrice

  const tierDiscount = getTierDiscount(product.priceTiers, qty, basePrice)
  const discountedSku = getEffectivePrice({ price: skuPrice, discountPct: product.discountPct })
  const unitPrice = calculateUnitPrice({
    basePrice,
    skuPrice,
    quantity: qty,
    priceTiers: product.priceTiers,
    discountPct: product.discountPct,
  })
  const totalPrice = calculateTotalPrice({
    basePrice,
    skuPrice,
    quantity: qty,
    priceTiers: product.priceTiers,
    discountPct: product.discountPct,
  })
  const priceBands = buildPriceBands({
    moq,
    basePrice,
    skuPrice,
    discountPct: product.discountPct,
    priceTiers: product.priceTiers,
  })

  function handleAdd() {
    const variant =
      selectedVariant !== null && product.variants
        ? product.variants[selectedVariant]
        : null
    const item = {
      ...product,
      listPrice: basePrice,
      skuPrice,
      price: basePrice,
      name: variant ? `${product.name} — ${variant.label}` : product.name,
    }
    addItem(item, qty)
    flyToBag(galleryRef.current)
    announce(`Added ${qty} × ${item.name} to cart`)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1800)
  }

  const inStock = product.stock > 0
  const lowStock = product.stock > 0 && product.stock <= 10
  const tags = productTags(product)
  const displaySize =
    selectedVariant !== null && product.variants
      ? product.variants[selectedVariant].label
      : product.size
  const showBands = priceBands.length > 0 && (Boolean(product.priceTiers?.length) || moq > 1)
  const categoryHref = `/shop?category=${encodeURIComponent(slugifyCategory(product.category))}`

  return (
    <section className="mx-auto max-w-7xl px-5 pb-12 pt-6 md:pb-20 md:pt-10 lg:px-8">
      {/* Breadcrumb: full trail on desktop, one back link on phones */}
      <nav aria-label="Breadcrumb" className="mb-6 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <Link
          href={isDeal ? "/deals" : categoryHref}
          className="inline-flex min-h-11 items-center gap-1 text-navy sm:hidden"
        >
          <ChevronLeft aria-hidden className="size-4" /> {isDeal ? "Combo deals" : product.category}
        </Link>
        <ol className="hidden flex-wrap items-center gap-2 sm:flex">
          {(isDeal
            ? [{ label: "Home", href: "/" }, { label: "Combo deals", href: "/deals" }]
            : [{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, { label: product.category, href: categoryHref }]
          ).map(crumb => (
            <li key={crumb.href} className="flex items-center gap-2">
              <Link href={crumb.href} className="hover:text-navy">{crumb.label}</Link>
              <ChevronRight aria-hidden className="size-3" />
            </li>
          ))}
          <li aria-current="page" className="text-foreground">{product.name}</li>
        </ol>
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
        {/* Gallery */}
        <div ref={galleryRef} className="lg:sticky lg:top-24">
          <PdpGallery
            images={gallery}
            productName={product.name}
            morphName={isDeal ? undefined : productMorphName(product.id)}
            overlay={
              tags.length > 0 || hasDiscount(product) ? (
                <ul className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1" aria-label="Product labels">
                  {tags.map(t => (
                    <li
                      key={t}
                      className={cn(
                        "px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em]",
                        t === "Bestseller" || t === "Low Stock" ? "bg-navy text-primary-foreground" : "bg-blush text-navy-deep",
                      )}
                    >
                      {t}
                    </li>
                  ))}
                  {hasDiscount(product) && (
                    <li className="bg-rose px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white">
                      −{product.discountPct}%
                    </li>
                  )}
                </ul>
              ) : null
            }
          />
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-col">
          <p className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.22em] text-rose">
            <span aria-hidden className="h-px w-8 bg-rose" />
            {product.brand}
          </p>
          <h1 className="mt-3 text-balance font-serif text-[clamp(2rem,1.6rem+1.5vw,3rem)] font-normal leading-[1.06] tracking-[-0.01em] text-navy-deep">
            {product.name}
            {displaySize ? <span className="text-muted-foreground"> — {displaySize}</span> : null}
          </h1>

          {product.reviewCount > 0 && (
            <a href="#reviews" className="mt-3 inline-flex min-h-9 w-fit items-center gap-2 text-sm text-muted-foreground hover:text-navy">
              <span className="flex items-center gap-0.5" aria-hidden>
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} className={cn("size-4", product.rating >= i - 0.25 ? "fill-navy text-navy" : "fill-transparent text-navy/60")} />
                ))}
              </span>
              <span>
                <span className="sr-only">Rated </span>
                {product.rating.toFixed(1)}
                <span className="sr-only"> out of 5</span> · {product.reviewCount} reviews
              </span>
            </a>
          )}

          {/* Price: discounted SKU − volume tier ₦ (general % + tier stack) */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Price
              ticker
              amount={unitPrice}
              compareAt={unitPrice < skuPrice ? skuPrice : null}
              size="lg"
              suffix={moq > 1 || product.priceTiers?.length ? "/ unit" : undefined}
            />
            {tierDiscount > 0 && (
              <span className="rounded-control border border-border px-2 py-1 text-xs font-medium text-muted-foreground">
                −<Money amount={tierDiscount} /> volume
              </span>
            )}
          </div>
          {hasDiscount(product) && tierDiscount > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              After {product.discountPct}% → <Money amount={discountedSku} />, then −<Money amount={tierDiscount} /> volume
            </p>
          )}
          {qty > 1 && (
            <p className="mt-1 text-sm text-muted-foreground">
              Line total <span className="font-medium text-foreground tabular-nums"><Money amount={totalPrice} /></span> for {qty}
            </p>
          )}
          {moq > 1 && (
            <p className="mt-1 text-sm text-muted-foreground">
              Minimum order quantity: <span className="font-medium text-foreground">{moq}</span>
            </p>
          )}

          {showBands && (
            <table className="mt-4 w-full border border-border text-sm">
              <caption className="border-b border-border px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Price by quantity
              </caption>
              <tbody className="divide-y divide-border">
                {priceBands.map(band => {
                  const active = qty >= band.minQty && (band.maxQty == null || qty <= band.maxQty)
                  return (
                    <tr key={`${band.minQty}-${band.maxQty ?? "open"}`} className={cn(active && "bg-secondary")}>
                      <th scope="row" className="px-3 py-2 text-left font-normal">{band.label}</th>
                      <td className="px-3 py-2 text-right font-medium tabular-nums"><Money amount={band.unitPrice} /> each</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          <p className={cn("mt-4 flex items-center gap-2 text-sm font-medium", inStock ? (lowStock ? "text-warning" : "text-success") : "text-destructive")}>
            {inStock ? (lowStock ? <CircleAlert aria-hidden className="size-4" /> : <CircleCheck aria-hidden className="size-4" />) : <CircleX aria-hidden className="size-4" />}
            {inStock ? (lowStock ? `Only ${product.stock} left in stock` : "In stock") : "Currently out of stock"}
          </p>

          {product.description && (
            <p className="mt-6 border-t border-border pt-6 text-pretty leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          )}

          {/* Variant / size selector */}
          {product.variants && product.variants.length > 0 ? (
            <fieldset className="mt-6">
              <legend className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-foreground">
                Size
                {selectedVariant !== null && (
                  <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">
                    {product.variants[selectedVariant].label}
                  </span>
                )}
              </legend>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v, idx) => (
                  // Native radio: one-of-many semantics and arrow-key behaviour for free.
                  <label
                    key={v.label}
                    className={cn(
                      "flex min-h-12 cursor-pointer flex-col items-start justify-center rounded-control border px-4 py-2 text-sm transition-colors duration-200",
                      "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                      selectedVariant === idx
                        ? "border-navy bg-navy text-primary-foreground"
                        : "border-input text-foreground hover:border-navy",
                    )}
                  >
                    <input
                      type="radio"
                      name={`variant-${product.id}`}
                      value={v.label}
                      checked={selectedVariant === idx}
                      onChange={() => setSelectedVariant(idx)}
                      className="sr-only"
                      data-focus="custom"
                    />
                    <span className="font-medium">{v.label}</span>
                    <span className={cn("text-xs tabular-nums", selectedVariant === idx ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      <Money
                        amount={calculateUnitPrice({
                          basePrice,
                          skuPrice: v.price,
                          quantity: qty,
                          priceTiers: product.priceTiers,
                          discountPct: product.discountPct,
                        })}
                      />
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : product.size ? (
            <p className="mt-6 text-sm">
              <span className="mr-2 text-xs font-medium uppercase tracking-[0.14em]">Size</span>
              <span className="text-muted-foreground">{product.size}</span>
            </p>
          ) : null}

          {/* Quantity, add to cart, favourite */}
          <div ref={ctaRef} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="flex h-12 items-center rounded-control border border-input sm:w-36">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQty(q => Math.max(moq, q - 1))}
                disabled={qty <= moq}
                className="flex size-12 items-center justify-center text-navy disabled:opacity-30"
              >
                <Minus aria-hidden className="size-4" />
              </button>
              <output aria-live="polite" aria-label="Quantity" className="flex-1 text-center tabular-nums">{qty}</output>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQty(q => Math.min(product.stock > 0 ? product.stock : q + 1, q + 1))}
                className="flex size-12 items-center justify-center text-navy"
              >
                <Plus aria-hidden className="size-4" />
              </button>
            </div>
            <Button onClick={handleAdd} disabled={!inStock} className="btn-sheen flex-1">
              {!inStock ? "Out of stock" : added ? <><Check aria-hidden /> Added to cart</> : "Add to cart"}
            </Button>
            <IconButton
              label={`Save ${product.name} to favourites`}
              aria-pressed={favorited}
              variant="outline"
              size="lg"
              onClick={() => {
                toggleFavorite(product)
                announce(favorited ? `Removed ${product.name} from favourites` : `Saved ${product.name} to favourites`)
              }}
              className={cn("hidden sm:inline-flex", favorited && "border-rose text-rose")}
            >
              <Heart aria-hidden className={cn("size-5", favorited && "fill-current")} strokeWidth={1.5} />
            </IconButton>
          </div>
          <button
            type="button"
            onClick={() => {
              toggleFavorite(product)
              announce(favorited ? `Removed ${product.name} from favourites` : `Saved ${product.name} to favourites`)
            }}
            aria-pressed={favorited}
            className="mt-2 inline-flex min-h-11 w-fit items-center gap-2 text-sm text-navy sm:hidden"
          >
            <Heart aria-hidden className={cn("size-4", favorited && "fill-current text-rose")} strokeWidth={1.5} />
            {favorited ? "Saved to favourites" : "Save to favourites"}
          </button>

          <ul className="mt-6 grid grid-cols-3 divide-x divide-navy/10 border-y border-navy/10 bg-porcelain text-xs text-navy-deep">
            <li className="flex flex-col items-center gap-2 px-2 py-4 text-center"><Truck aria-hidden className="size-5 shrink-0 text-rose" strokeWidth={1.5} /> Delivery arranged after order</li>
            <li className="flex flex-col items-center gap-2 px-2 py-4 text-center"><ShieldCheck aria-hidden className="size-5 shrink-0 text-rose" strokeWidth={1.5} /> 100% authentic</li>
            <li className="flex flex-col items-center gap-2 px-2 py-4 text-center"><RotateCcw aria-hidden className="size-5 shrink-0 text-rose" strokeWidth={1.5} /> Easy returns</li>
          </ul>

          {/* Details */}
          <div className="mt-8 border-t border-border">
            {((!hideBenefits && product.benefits.length > 0) || product.concerns.length > 0) && (
              <Disclosure summary="Benefits" defaultOpen summaryClassName={PDP_SUMMARY}>
                {!hideBenefits && product.benefits.length > 0 && (
                  <ul className="space-y-2">
                    {product.benefits.map(b => (
                      <li key={b} className="flex items-start gap-3">
                        <Check aria-hidden className="mt-1 size-4 shrink-0 text-navy" /> {b}
                      </li>
                    ))}
                  </ul>
                )}
                {product.concerns.length > 0 && (
                  <>
                    <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-[0.14em] text-foreground">Best for</p>
                    <div className="flex flex-wrap gap-2">
                      {product.concerns.map(c => (
                        <CatalogChip key={c} label={c} href={`/concern/${slugifyCatalogLabel(c)}`} linked={PINNED_CONCERNS.has(c)} />
                      ))}
                    </div>
                  </>
                )}
              </Disclosure>
            )}
            {howToUse && (
              <Disclosure summary="How to use" summaryClassName={PDP_SUMMARY}>
                <p className="whitespace-pre-line">{howToUse}</p>
              </Disclosure>
            )}
            {product.ingredients.length > 0 && (
              <Disclosure summary="Key ingredients" summaryClassName={PDP_SUMMARY}>
                <div className="flex flex-wrap gap-2">
                  {product.ingredients.map(i => (
                    <CatalogChip key={i} label={i} href={`/ingredient/${slugifyCatalogLabel(i)}`} linked={PINNED_INGREDIENTS.has(i)} />
                  ))}
                </div>
                <p className="mt-3 text-xs">Check the product packaging for the full ingredient list.</p>
              </Disclosure>
            )}
            <Disclosure summary="Delivery & returns" summaryClassName={PDP_SUMMARY}>
              <p>{DELIVERY_NOTE}</p>
              <p className="mt-2">
                See our <Link href="/shipping" prefetch={false} className="text-navy underline underline-offset-4">shipping</Link> and{" "}
                <Link href="/returns" prefetch={false} className="text-navy underline underline-offset-4">returns</Link> pages for details.
              </p>
            </Disclosure>
          </div>
        </div>
      </div>

      <StickyBuyBar
        watchRef={ctaRef}
        name={product.name}
        brand={product.brand}
        image={gallery[0]}
        amount={unitPrice}
        compareAt={unitPrice < skuPrice ? skuPrice : null}
        disabled={!inStock}
        added={added}
        onAdd={handleAdd}
      />
    </section>
  )
}
