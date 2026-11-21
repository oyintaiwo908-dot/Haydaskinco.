import Link from "next/link"
import Image from "next/image"
import { getActiveDeals } from "@/lib/supabase/deals"
import { dealSalePrice } from "@/lib/deals"
import { Price } from "@/components/ui/price"
import { SectionHeading } from "@/components/ui/section-heading"

export async function RelatedDeals({ currentId }: { currentId: string }) {
  const deals = (await getActiveDeals()).filter(d => d.id !== currentId).slice(0, 3)
  if (!deals.length) return null

  return (
    <section className="mx-auto max-w-7xl border-t border-border px-5 py-[clamp(3rem,2rem+4vw,6rem)] lg:px-8" aria-labelledby="more-deals-title">
      <SectionHeading eyebrow="Bundles" title={<span id="more-deals-title">More combo deals</span>} className="mb-8" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {deals.map(deal => {
          const sale = dealSalePrice(deal)
          return (
            <Link key={deal.id} href={`/deal/${deal.id}`} className="group block">
              <div className="relative aspect-[4/3] overflow-hidden bg-porcelain">
                <Image
                  src={deal.image || "/product-bundle.png"}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-700 ease-atelier group-hover:scale-[1.04]"
                />
              </div>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{deal.brand}</p>
              <h3 className="mt-1 font-serif text-xl text-navy-deep group-hover:underline group-hover:underline-offset-4">{deal.title}</h3>
              <Price amount={sale} compareAt={deal.originalPrice > sale ? deal.originalPrice : null} size="sm" className="mt-1" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
