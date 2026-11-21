import type { Metadata } from "next"
import { cache } from "react"
import { notFound } from "next/navigation"
import { getProductById, getProductIds, getRelatedProducts } from "@/lib/supabase/products"
import { ProductDetail } from "@/components/product-detail"
import { ProductReviews } from "@/components/product-reviews"
import { RelatedProducts } from "@/components/related-products"

/**
 * 1h ISR; admin saves refresh it on demand (app/actions/revalidate.ts). Short windows burn
 * Vercel CPU. Shown stock can lag a sale by up to 1h; /api/orders re-checks stock and price.
 */
export const revalidate = 3600

/** One product fetch per render, shared by generateMetadata and the page. */
const getProduct = cache((id: string) => getProductById(id))

export async function generateStaticParams() {
  const ids = await getProductIds()
  return ids.map((id) => ({ id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) return { title: "Product Not Found — HAYDA SKINCo." }
  return {
    title: `${product.name} — HAYDA SKINCo.`,
    description: product.description,
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) notFound()

  const related = await getRelatedProducts(product.id, 8)

  return (
    <>
      <ProductDetail product={product} />
      <RelatedProducts products={related} />
      <ProductReviews productId={product.id} />
    </>
  )
}
