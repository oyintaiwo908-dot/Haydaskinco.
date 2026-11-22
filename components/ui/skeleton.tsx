import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

/** Placeholder block. Decorative: hidden from assistive tech. Pulse stops under reduced motion. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("shimmer bg-neutral-100", className)} {...props} />
}

/** Matches the product card footprint (4:5 media, brand, name, price) to avoid layout shift. */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex flex-col", className)}>
      <Skeleton className="aspect-4/5 w-full" />
      <Skeleton className="mt-4 h-3 w-1/3" />
      <Skeleton className="mt-2.5 h-5 w-3/4" />
      <Skeleton className="mt-2.5 h-4 w-1/4" />
    </div>
  )
}

/** Grid of card skeletons. Pass the same grid classes as the real grid. */
export function ProductGridSkeleton({
  count = 4,
  className = "grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-6 md:gap-y-10",
  label = "Loading products",
}: {
  count?: number
  className?: string
  label?: string
}) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}
