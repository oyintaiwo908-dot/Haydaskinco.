"use client"

import { useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react"
import { useCart } from "@/components/cart-provider"
import { Sheet } from "@/components/ui/sheet"
import { Button, buttonVariants } from "@/components/ui/button"
import { Money } from "@/components/ui/price"
import { MoneyTicker } from "@/components/motion/money-ticker"
import { animateOut, useFlip } from "@/components/motion/use-flip"
import { bareDealId, isDealCartId } from "@/lib/deals"
import { getProductMoq, getUnitPriceForQuantity } from "@/lib/products"
import { cn } from "@/lib/utils"
import { FREE_STANDARD_DELIVERY } from "@/lib/storefront-copy"

/**
 * Cart as a native <dialog> side sheet (focus trap, Escape, focus return, scroll lock).
 * Stock is refreshed by CartProvider whenever the cart opens.
 */
export function CartDrawer() {
  const {
    items, count, subtotal, isOpen, openCart, closeCart, removeItem, updateQuantity,
    stockById, hasStockIssues, stockChecking,
  } = useCart()
  const listRef = useRef<HTMLUListElement>(null)
  useFlip(listRef, items.map(i => `${i.id}:${i.quantity}`).join("|"))
  /** Rows slide out, then the cart updates and the rest glide up (useFlip). */
  const removeAnimated = (id: string, row: Element | null) => {
    void animateOut(row).then(() => removeItem(id))
  }

  const footer =
    items.length > 0 ? (
      <div className="space-y-3">
        {hasStockIssues && (
          <p id="cart-stock-alert" role="alert" className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {stockChecking ? "Checking stock…" : "Some items are out of stock or limited. Update your cart before checkout."}
          </p>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Subtotal</span>
          <span className="font-serif text-3xl text-navy-deep tabular-nums"><MoneyTicker amount={subtotal} /></span>
        </div>
        <p className="text-sm text-muted-foreground">
          {FREE_STANDARD_DELIVERY}. Express is <Money amount={3000} /> at checkout.
        </p>
        {hasStockIssues ? (
          // Real disabled control; the reason is the full-contrast alert above it.
          <Button block size="lg" disabled aria-describedby="cart-stock-alert">
            Checkout
          </Button>
        ) : (
          <Link href="/checkout" onClick={closeCart} className={buttonVariants({ block: true, size: "lg" })}>
            Checkout
          </Link>
        )}
        <button
          type="button"
          onClick={closeCart}
          className="block min-h-11 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Continue shopping
        </button>
      </div>
    ) : undefined

  return (
    <Sheet
      open={isOpen}
      onOpenChange={open => (open ? openCart() : closeCart())}
      side="right"
      title={
        <span className="flex items-center gap-3">
          Your cart
          {count > 0 && (
            <span className="text-base font-normal text-muted-foreground tabular-nums">
              ({count} {count === 1 ? "item" : "items"})
            </span>
          )}
        </span>
      }
      footer={footer}
      bodyClassName="py-2"
    >
      {items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-5 py-16 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-porcelain text-navy">
            <ShoppingBag aria-hidden className="size-7" strokeWidth={1.5} />
          </span>
          <div>
            <p className="font-serif text-2xl text-navy-deep">Your cart is empty</p>
            <p className="mt-1.5 text-muted-foreground">Find something you love and it will wait here.</p>
          </div>
          <Link href="/shop" onClick={closeCart} className={buttonVariants({ variant: "outline" })}>
            Shop now
          </Link>
        </div>
      ) : (
        <ul ref={listRef} className="divide-y divide-navy/10">
          {items.map((item, index) => {
            const stock = stockById[item.id]
            const unavailable = Boolean(stock?.unavailable)
            const atMax = Boolean(stock && !stock.unavailable && item.quantity >= stock.available)
            const moq = isDealCartId(item.id) ? 1 : getProductMoq(item)
            const basePrice = item.listPrice ?? item.price
            const skuPrice = item.skuPrice ?? basePrice
            const unit = getUnitPriceForQuantity(
              {
                price: basePrice,
                listPrice: basePrice,
                skuPrice,
                priceTiers: item.priceTiers,
                discountPct: item.discountPct,
              },
              item.quantity,
            )
            const href = isDealCartId(item.id) ? `/deal/${bareDealId(item.id)}` : `/product/${item.id}`
            const isDealPlaceholder = isDealCartId(item.id) && (!item.image || item.image === "/product-bundle.png")
            return (
              <li
                key={item.id}
                data-flip-key={item.id}
                className="cart-line flex gap-4 py-5"
                style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
              >
                <Link href={href} prefetch={false} onClick={closeCart} className={cn("relative aspect-4/5 w-20 shrink-0 overflow-hidden bg-porcelain", unavailable && "opacity-50")} tabIndex={-1} aria-hidden>
                  {isDealPlaceholder ? (
                    <span className="flex size-full items-center justify-center text-navy/60">
                      <ShoppingBag className="size-7" strokeWidth={1.5} />
                    </span>
                  ) : (
                    <Image src={item.image || "/placeholder.svg"} alt="" fill sizes="80px" className="object-cover" />
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose">
                        {isDealCartId(item.id) ? "Bundle deal" : item.brand || item.category}
                      </p>
                      <Link href={href} prefetch={false} onClick={closeCart} className="mt-0.5 block font-serif text-lg leading-snug text-navy-deep hover:underline hover:underline-offset-4">
                        {item.name}
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={e => removeAnimated(item.id, e.currentTarget.closest("li"))}
                      aria-label={`Remove ${item.name} from cart`}
                      className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>

                  {moq > 1 && <p className="text-xs text-muted-foreground">MOQ {moq} · <Money amount={unit} /> each</p>}
                  {moq <= 1 && item.priceTiers && item.priceTiers.length > 0 && (
                    <p className="text-xs text-muted-foreground"><Money amount={unit} /> each</p>
                  )}
                  {unavailable && <p className="text-xs font-medium text-destructive">Out of stock: remove to continue</p>}
                  {stock && !unavailable && stock.exceeds && (
                    <p className="text-xs font-medium text-warning">Only {stock.available} available: reduce quantity</p>
                  )}
                  {stock && !unavailable && !stock.exceeds && stock.available <= 10 && (
                    <p className="text-xs text-warning">Only {stock.available} left</p>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className={cn("flex h-11 items-center rounded-control border", unavailable ? "border-destructive/40" : "border-input")}>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        aria-label={item.quantity <= moq ? `Remove ${item.name} (below minimum quantity)` : `Decrease quantity of ${item.name}`}
                        disabled={unavailable}
                        className="flex size-11 items-center justify-center text-navy disabled:opacity-30"
                      >
                        <Minus aria-hidden className="size-3.5" />
                      </button>
                      <output aria-live="polite" aria-label={`Quantity of ${item.name}`} className="w-8 text-center text-sm font-medium tabular-nums">
                        {item.quantity}
                      </output>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        aria-label={`Increase quantity of ${item.name}`}
                        disabled={unavailable || atMax}
                        className="flex size-11 items-center justify-center text-navy disabled:opacity-30"
                      >
                        <Plus aria-hidden className="size-3.5" />
                      </button>
                    </div>
                    <p className="font-serif text-lg tabular-nums text-navy-deep">{unavailable ? <span className="font-sans text-xs text-destructive">Unavailable</span> : <MoneyTicker amount={unit * item.quantity} />}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
