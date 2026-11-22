import type { Metadata } from "next"
import { Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { ProductCard } from "@/components/product-card"
import { ShopGrid } from "@/components/shop-grid"
import { ShopHeading, type ShopHeadingText } from "@/components/shop-heading"
import { ShopToolbar } from "@/components/shop-toolbar"
import { queryProducts } from "@/lib/supabase/products"

/**
 * /shop is static with 1h ISR (admin product saves refresh it on demand).
 * Do not read `searchParams` here: that makes every visit, filter click and prefetch a
 * Vercel Function render. Filters (?category, ?brand, ?skinType, ?sale, ?filter) are
 * applied in the browser by ShopHeading and ShopGrid, which already query Supabase directly.
 */
export const revalidate = 3600

const DEFAULT_HEADING: ShopHeadingText = {
  eyebrow: "All Products",
  title: "Shop All Skincare",
  description: "Trusted brands. Authentic products.",
}

export const metadata: Metadata = {
  title: "Shop All Skincare — HAYDA SKINCo.",
  description: DEFAULT_HEADING.description,
  // Filtered URLs (/shop?category=…) serve the same HTML, so they canonicalise to /shop.
  alternates: { canonical: "/shop" },
}

export default async function ShopPage() {
  const products = await queryProducts({ sort: "featured", limit: 96 })

  return (
    <>
      <Suspense fallback={<PageHeader {...DEFAULT_HEADING} />}>
        <ShopHeading fallback={DEFAULT_HEADING} />
      </Suspense>
      {/* Server HTML (and crawlers) get the full product list; the interactive grid takes over in the browser. */}
      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-5 py-8 md:py-12 lg:px-8">
            {/* Same toolbar as ShopGrid (inert here) so the grid does not jump when it hydrates. */}
            <div className="lg:ml-[calc(260px+3rem)]">
              <ShopToolbar placeholder countLabel={`${products.length} product${products.length === 1 ? "" : "s"}`} />
            </div>
            <div className="grid grid-cols-2 items-start gap-x-3 gap-y-8 sm:grid-cols-3 md:gap-x-6 md:gap-y-12 lg:ml-[calc(260px+3rem)] xl:grid-cols-4">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </div>
        }
      >
        <ShopGrid initialProducts={products} />
      </Suspense>
    </>
  )
}
