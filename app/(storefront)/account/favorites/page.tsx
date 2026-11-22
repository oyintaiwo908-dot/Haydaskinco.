"use client"

import Image from "next/image"
import Link from "next/link"
import { Heart, ShoppingBag, Plus, Check } from "lucide-react"
import { useState } from "react"
import { useFavorites } from "@/components/favorites-provider"
import { useCart } from "@/components/cart-provider"
import { formatPrice } from "@/lib/products"
import { bareDealId, isDealCartId } from "@/lib/deals"
import { cn } from "@/lib/utils"

export default function AccountFavoritesPage() {
  const { favorites, removeFavorite } = useFavorites()
  const { addItem } = useCart()
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  function handleAddToCart(productId: string, product: Parameters<typeof addItem>[0]) {
    addItem(product)
    setAddedIds(prev => new Set([...prev, productId]))
    setTimeout(() => setAddedIds(prev => { const n = new Set(prev); n.delete(productId); return n }), 1800)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-medium">Favourites</h2>
        <p className="mt-1 text-sm font-light text-muted-foreground">
          {favorites.length} saved product{favorites.length !== 1 ? "s" : ""}
        </p>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border py-20 text-center">
          <Heart className="size-10 text-muted-foreground mb-4" />
          <p className="font-serif text-xl font-medium">No favourites yet</p>
          <p className="mt-2 text-sm font-light text-muted-foreground max-w-xs">
            Tap the heart icon on any product to save it here for easy access.
          </p>
          <Link
            href="/shop"
            className="mt-6 flex items-center gap-2 bg-foreground px-8 py-3 text-xs font-medium uppercase tracking-[0.18em] text-background hover:bg-gold hover:text-gold-foreground transition-colors"
          >
            <ShoppingBag className="size-3.5" /> Browse Products
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
            {favorites.map(product => {
              const added = addedIds.has(product.id)
              const href = isDealCartId(product.id)
                ? `/deal/${bareDealId(product.id)}`
                : `/product/${product.id}`
              return (
                <article key={product.id} className="group flex flex-col">
                  <div className="product-stage relative aspect-4/5 overflow-hidden transition-colors">
                    <Link href={href} aria-label={`View ${product.name}`}>
                      <Image
                        src={product.image || "/placeholder.svg"}
                        alt={product.name}
                        fill
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                    </Link>

                    {/* Remove favourite */}
                    <button
                      type="button"
                      onClick={() => removeFavorite(product.id)}
                      aria-label={`Remove ${product.name} from favourites`}
                      className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full border border-gold/40 bg-lavender text-gold backdrop-blur-sm transition-all hover:bg-destructive/20 hover:border-destructive/40 hover:text-destructive"
                    >
                      <Heart className="size-3.5 fill-gold transition-colors hover:fill-transparent" />
                    </button>

                    {/* Add to cart */}
                    <div className="absolute inset-x-3 bottom-3 translate-y-3 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleAddToCart(product.id, product)}
                        className={cn(
                          "flex w-full items-center justify-center gap-2 border px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] backdrop-blur-sm transition-all duration-300",
                          added
                            ? "border-gold bg-gold text-gold-foreground"
                            : "border-foreground bg-background/90 text-foreground hover:border-gold hover:bg-gold hover:text-gold-foreground",
                        )}
                      >
                        {added ? (
                          <><Check className="size-3.5" /> Added</>
                        ) : (
                          <><Plus className="size-3.5" /> Add to Cart</>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col items-center px-1 pt-4 text-center">
                    <p className="text-[10px] font-light uppercase tracking-[0.22em] text-gold">
                      {isDealCartId(product.id) ? "Bundle Deal" : product.category}
                    </p>
                    <h3 className="mt-1.5 font-serif text-lg font-medium leading-snug">
                      <Link href={href} className="transition-colors hover:text-gold">
                        {product.name}
                      </Link>
                    </h3>
                    <p className="mt-1 text-xs font-light text-muted-foreground">{product.tagline}</p>
                    <p className="mt-2 text-sm font-light tracking-wide">{formatPrice(product.price)}</p>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="pt-2 text-center">
            <Link href="/shop" className="text-xs font-light uppercase tracking-[0.18em] text-muted-foreground underline-offset-2 hover:text-gold hover:underline transition-colors">
              Continue browsing
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
