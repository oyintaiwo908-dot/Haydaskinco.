import type { Metadata } from "next"
import { cache } from "react"
import { notFound } from "next/navigation"
import { getDealById, getDealIds } from "@/lib/supabase/deals"
import { dealAsProduct, dealSalePrice } from "@/lib/deals"
import { ProductDetail } from "@/components/product-detail"
import { ProductReviews } from "@/components/product-reviews"
import { RelatedDeals } from "@/components/related-deals"

/** 1h ISR; admin saves refresh it on demand (app/actions/revalidate.ts). Short windows burn Vercel CPU. */
export const revalidate = 3600

/** One deal fetch per render, shared by generateMetadata and the page. */
const getDeal = cache((id: string) => getDealById(id))

export async function generateStaticParams() {
  const ids = await getDealIds()
  return ids.map((id) => ({ id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const deal = await getDeal(id)
  if (!deal || deal.status !== "active") {
    return { title: "Deal Not Found — HAYDA SKINCo." }
  }
  return {
    title: `${deal.title} — HAYDA SKINCo.`,
    description: deal.description || deal.subtitle,
  }
}

export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const deal = await getDeal(id)
  if (!deal || deal.status !== "active") notFound()

  const product = dealAsProduct(deal)
  // Ensure sale math matches current discount even if DB price drifted
  const sale = dealSalePrice(deal)
  if (sale !== product.price && !product.discountPct) {
    product.price = deal.originalPrice
    product.discountPct =
      deal.originalPrice > 0 && sale < deal.originalPrice
        ? Math.round((1 - sale / deal.originalPrice) * 100)
        : undefined
  }

  return (
    <>
      <ProductDetail product={product} hideBenefits />
      <section className="mx-auto max-w-7xl px-5 pb-12 lg:px-8" aria-labelledby="deal-included">
        <div className="max-w-2xl border-t border-border pt-8">
          <h2 id="deal-included" className="mb-4 font-serif text-2xl text-navy-deep">What&apos;s included</h2>
          <ul className="divide-y divide-border border-y border-border">
            {deal.items.map((item) => (
              <li
                key={`${item.productId}-${item.variantLabel ?? item.size}`}
                className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-navy" />
                  <span className="truncate">{item.name}</span>
                  {(item.variantLabel || item.size) && (
                    <span className="text-muted-foreground shrink-0">
                      ({item.variantLabel || item.size})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <ProductReviews productId={product.id} />
      <RelatedDeals currentId={deal.id} />
    </>
  )
}
