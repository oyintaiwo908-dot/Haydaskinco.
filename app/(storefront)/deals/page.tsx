"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { ShoppingBag, Tag, ArrowRight, Check } from "lucide-react"
import { type Deal, dealAsProduct, dealSalePrice } from "@/lib/deals"
import { getActiveDeals } from "@/lib/supabase/deals"
import { useCart } from "@/components/cart-provider"
import { cn } from "@/lib/utils"
import { whatsAppHref } from "@/lib/whatsapp"
import { DELIVERY_SHORT } from "@/lib/storefront-copy"

export default function DealsPage() {
  const [activeDeals, setActiveDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getActiveDeals().then(data => {
      setActiveDeals(data)
      setLoading(false)
    })
  }, [])

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      <div className="border-b border-border pb-8 mb-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-gold mb-2">Save More</p>
        <h1 className="font-serif text-4xl font-medium">Combo Deals & Kits</h1>
        <p className="mt-2 text-base font-light text-muted-foreground max-w-xl">
          Expertly curated skincare bundles at discounted prices. All products are authentic and sourced directly from authorised distributors.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {([
            { label: DELIVERY_SHORT },
            { label: "100% authentic" },
            { label: "Easy returns", href: "/returns" },
          ] as { label: string; href?: string }[]).map(b => (
            b.href ? (
              <Link
                key={b.label}
                href={b.href}
                className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-[11px] font-light text-muted-foreground transition-colors hover:text-foreground"
              >
                <Tag className="size-3 text-gold" /> {b.label}
              </Link>
            ) : (
              <span key={b.label} className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-[11px] font-light text-muted-foreground">
                <Tag className="size-3 text-gold" /> {b.label}
              </span>
            )
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading
          ? [...Array(3)].map((_, i) => (
            <div key={i} className="border border-border overflow-hidden">
              <div className="aspect-[4/3] bg-muted/50 animate-pulse" />
              <div className="p-6 space-y-3">
                <div className="h-4 w-24 bg-muted/50 animate-pulse" />
                <div className="h-6 w-full bg-muted/50 animate-pulse" />
              </div>
            </div>
          ))
          : activeDeals.map(deal => (
            <DealCard key={deal.id} deal={deal} />
          ))
        }
      </div>

      <div className="mt-14 bg-muted border border-border p-8 text-center">
        <h3 className="font-serif text-2xl font-medium mb-2">Need a custom bundle?</h3>
        <p className="text-sm font-light text-muted-foreground mb-5 max-w-md mx-auto">
          Can&apos;t find the right combination? Chat with us on WhatsApp and we&apos;ll curate a personalised skincare kit just for you.
        </p>
        <a
          href={whatsAppHref("Hi! I'd like a custom skincare bundle recommendation.")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#25D366] px-8 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-90"
        >
          Chat on WhatsApp <ArrowRight className="size-3.5" />
        </a>
      </div>
    </div>
  )
}

function DealCard({ deal }: { deal: Deal }) {
  const { addItem, openCart } = useCart()
  const [added, setAdded] = useState(false)
  const sale = dealSalePrice(deal)

  function handleAddBundle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    addItem(dealAsProduct(deal))
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
    setTimeout(() => openCart(), 300)
  }

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden border transition-all hover:shadow-md",
        deal.highlight ? "border-gold/60 bg-lavender/30" : "border-border hover:border-gold/40",
      )}
    >
      <Link href={`/deal/${deal.id}`} className="relative aspect-[4/3] overflow-hidden bg-muted block">
        <Image
          src={deal.image || "/product-bundle.png"}
          alt={deal.title}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-500 hover:scale-105"
        />
        {deal.badge && (
          <span className="absolute left-3 top-3 bg-gold text-gold-foreground px-2 py-0.5 text-[11px] font-medium">
            {deal.badge}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-6">
        <p className="text-[10px] font-light uppercase tracking-[0.18em] text-gold">{deal.brand}</p>
        <Link href={`/deal/${deal.id}`}>
          <h3 className="mt-1 font-serif text-xl font-medium hover:text-gold transition-colors">{deal.title}</h3>
        </Link>
        <p className="mt-0.5 text-xs font-light text-muted-foreground">{deal.subtitle}</p>
        {(deal.concerns?.length > 0 || deal.concern) && (
          <p className="mt-1.5 text-[10px] font-light text-gold">
            {(deal.concerns?.length ? deal.concerns : deal.concern!.split(/\s*·\s*/)).join(" · ")}
          </p>
        )}



        <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
          <div>
            {deal.originalPrice > sale && (
              <p className="text-xs font-light line-through text-muted-foreground">
                ₦{deal.originalPrice.toLocaleString()}
              </p>
            )}
            <p className="font-serif text-2xl font-medium">₦{sale.toLocaleString()}</p>
          </div>
          <button
            type="button"
            onClick={handleAddBundle}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.12em] transition-all",
              added
                ? "bg-gold text-gold-foreground"
                : "bg-foreground text-background hover:bg-gold hover:text-gold-foreground",
            )}
          >
            {added ? (
              <><Check className="size-3.5" /> Added!</>
            ) : (
              <><ShoppingBag className="size-3.5" /> Add Bundle</>
            )}
          </button>
        </div>

        <Link
          href={`/deal/${deal.id}`}
          className="mt-3 text-center text-[11px] font-light text-muted-foreground underline-offset-2 hover:text-gold hover:underline transition-colors"
        >
          View deal →
        </Link>
      </div>
    </article>
  )
}
