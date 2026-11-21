import type { Metadata } from "next"
import { cache } from "react"
import { notFound } from "next/navigation"
import { getProductById, getProductIds, getRelatedProducts } from "@/lib/supabase/products"
import { ProductDetail } from "@/components/product-detail"
import { ProductReviews } from "@/components/product-reviews"
import { RelatedProducts } from "@/components/related-products"
import { getEffectivePrice } from "@/lib/products"
import { getSiteUrl } from "@/lib/site"

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

  // schema.org Product data so Google can show price and stock in results.
  // Ratings are left out on purpose: only add them once reviews are real.
  const siteUrl = getSiteUrl()
  const toAbsolute = (src: string) => (src.startsWith("http") ? src : `${siteUrl}${src.startsWith("/") ? "" : "/"}${src}`)
  const images = (product.images?.length ? product.images : [product.image]).filter(Boolean).map(toAbsolute)
  const productUrl = `${siteUrl}/product/${product.id}`
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: images,
    description: product.description || product.tagline || undefined,
    sku: product.id,
    url: productUrl,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "NGN",
      price: getEffectivePrice(product),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "HAYDA SKINCo." },
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductDetail product={product} />
      <RelatedProducts products={related} />
      <ProductReviews productId={product.id} />
    </>
  )
}
