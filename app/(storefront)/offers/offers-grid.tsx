"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import type { Product } from "@/lib/products"
import { getDiscountedProducts } from "@/lib/supabase/products"
import { ProductCard } from "@/components/product-card"
import { Select } from "@/components/ui/field"
import { ProductGridSkeleton } from "@/components/ui/skeleton"
import { Tag } from "lucide-react"

const SORT_OPTIONS = [
  { label: "Best Discount", value: "discount" },
  { label: "Price: Low–High", value: "price-asc" },
  { label: "Price: High–Low", value: "price-desc" },
  { label: "Best Rated", value: "rating" },
]

const GRID = "grid grid-cols-2 items-start gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 md:gap-x-6 md:gap-y-12"

export function OffersGrid() {
  const searchParams = useSearchParams()
  const category = searchParams?.get("category") ?? "All"

  const [sort, setSort] = useState("discount")
  const requestKey = `${category}|${sort}`
  const [result, setResult] = useState<{ key: string | null; products: Product[] }>({ key: null, products: [] })
  const loading = result.key !== requestKey
  const products = result.products

  useEffect(() => {
    let cancelled = false
    getDiscountedProducts({
      category: category !== "All" ? category : undefined,
      sort,
    }).then(data => {
      if (!cancelled) setResult({ key: `${category}|${sort}`, products: data })
    })
    return () => { cancelled = true }
  }, [sort, category])

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading ? "Loading…" : `${products.length} product${products.length === 1 ? "" : "s"} on discount`}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="offers-sort" className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Sort
          </label>
          <div className="w-48">
            <Select id="offers-sort" value={sort} onChange={e => setSort(e.target.value)} className="h-10 text-sm">
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {loading && products.length === 0 ? (
        <ProductGridSkeleton count={4} className={GRID} />
      ) : products.length === 0 ? (
        <div className="flex flex-col items-start gap-3 border-t border-border py-16">
          <Tag aria-hidden className="size-8 text-muted-foreground" />
          <p className="font-serif text-2xl text-navy-deep">No discounted products right now.</p>
          <p className="text-sm text-muted-foreground">New offers are added regularly. Check back soon.</p>
        </div>
      ) : (
        <div className={GRID} aria-busy={loading}>
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
