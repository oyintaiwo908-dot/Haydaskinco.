import type { Metadata } from "next"
import { Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { ShopGrid } from "@/components/shop-grid"
import { queryProducts } from "@/lib/supabase/products"
import { getCategoryTree, resolveCategoryName } from "@/lib/supabase/categories"

export const metadata: Metadata = {
  title: "Shop — HAYDA SKINCo.",
  description:
    "Browse all skincare products stocked by HAYDA SKINCo. — CeraVe, The Ordinary, La Roche-Posay, COSRX, Paula's Choice, and more. Delivered nationwide.",
}

export const revalidate = 60

type Props = {
  searchParams: Promise<{ category?: string; brand?: string; skinType?: string }>
}

export default async function ShopPage({ searchParams }: Props) {
  const sp = await searchParams
  const tree = await getCategoryTree()
  const categoryName = sp.category
    ? resolveCategoryName(tree, sp.category) ?? undefined
    : undefined

  const products = await queryProducts({
    category: categoryName,
    brand: sp.brand,
    sort: "featured",
    limit: 96,
  })

  return (
    <>
      <PageHeader
        eyebrow="All Products"
        title="Shop All Skincare"
        description="Trusted brands. Authentic products. Delivered anywhere in Nigeria."
      />
      <Suspense>
        <ShopGrid
          initialProducts={products}
          initialCategory={categoryName ?? "All"}
        />
      </Suspense>
    </>
  )
}
