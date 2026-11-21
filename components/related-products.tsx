import { DragRail } from "@/components/drag-rail"
import { ProductCard } from "@/components/product-card"
import { SectionHeading } from "@/components/ui/section-heading"
import type { Product } from "@/lib/products"

/** "Pairs well with": related products as a draggable snap rail. */
export function RelatedProducts({ products }: { products: Product[] }) {
  if (!products.length) return null

  return (
    <section className="overflow-hidden bg-porcelain" aria-labelledby="related-title">
      <div className="mx-auto max-w-7xl px-5 py-[clamp(3.5rem,2rem+5vw,7rem)] lg:px-8">
        <SectionHeading
          eyebrow="Build the routine"
          title={<span id="related-title">Pairs well with</span>}
          description="Drag or swipe through products that work alongside this one."
          className="mb-10"
        />
        <DragRail label="Pairs well with" itemClassName="w-[68%] sm:w-[42%] md:w-[30%] lg:w-[23%]">
          {products.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} isWhiteBackground />
          ))}
        </DragRail>
      </div>
    </section>
  )
}
