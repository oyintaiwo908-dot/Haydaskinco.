import { ProductCard } from "@/components/product-card"
import type { Product } from "@/lib/products"

export function RelatedProducts({ products }: { products: Product[] }) {
  if (!products.length) return null

  return (
    <section className="border-t border-border bg-secondary">
      <div className="mx-auto max-w-7xl px-5 py-8 md:py-16 lg:px-8">
        <div className="mb-8 md:mb-12 flex flex-col items-center text-center">
          <h2 className="mt-4 font-serif text-2xl md:text-3xl font-medium text-foreground md:text-4xl">
            Related Products
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-x-3 md:gap-x-5 gap-y-6 md:gap-y-12 md:grid-cols-4">
          {products.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} isWhiteBackground />
          ))}
        </div>
      </div>
    </section>
  )
}
