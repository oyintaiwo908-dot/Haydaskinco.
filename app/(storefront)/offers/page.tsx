import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { countProducts } from "@/lib/supabase/products"
import { PageHeader } from "@/components/page-header"
import { OffersGrid } from "./offers-grid"
import { FREE_STANDARD_DELIVERY } from "@/lib/storefront-copy"

export const metadata: Metadata = {
  title: "Offers — HAYDA SKINCo.",
  description: "Shop sale items, limited-time deals, and discounted skincare at HAYDA SKINCo. Get premium skincare at the best prices.",
}

/** 1h ISR; admin saves refresh it on demand (app/actions/revalidate.ts). Short windows burn Vercel CPU. */
export const revalidate = 3600

export default async function OffersPage() {
  const discountCount = await countProducts({ discountOnly: true })

  return (
    <>
      <PageHeader
        eyebrow="Limited-Time Deals"
        title="Offers & Sale"
        description={`${discountCount} product${discountCount !== 1 ? "s" : ""} on discount now — premium skincare at reduced prices, while stocks last.`}
      />

      {/* Banner strip */}
      <div className="bg-foreground text-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-5 py-4 text-center lg:px-8">
          {([
            { text: FREE_STANDARD_DELIVERY },
            { text: "100% authentic" },
            { text: "Easy returns", href: "/returns" },
          ] as { text: string; href?: string }[]).map(item => (
            item.href ? (
              <Link key={item.text} href={item.href} className="text-xs font-light uppercase tracking-[0.15em] underline-offset-2 hover:underline">
                {item.text}
              </Link>
            ) : (
              <p key={item.text} className="text-xs font-light uppercase tracking-[0.15em]">{item.text}</p>
            )
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        {/* Category shortcuts */}
        <div className="mb-8 flex flex-wrap gap-2">
          {["All Offers", "Face", "Bath & Body", "Sunscreen", "Serums", "Moisturisers"].map(cat => (
            <Link
              key={cat}
              href={cat === "All Offers" ? "/offers" : `/offers?category=${cat}`}
              className="border border-border px-4 py-2 text-xs font-light uppercase tracking-[0.12em] text-muted-foreground transition-all hover:border-foreground hover:text-foreground"
            >
              {cat}
            </Link>
          ))}
        </div>

        <Suspense fallback={<div className="py-20 text-center text-sm font-light text-muted-foreground">Loading offers…</div>}>
          <OffersGrid />
        </Suspense>
      </div>
    </>
  )
}
