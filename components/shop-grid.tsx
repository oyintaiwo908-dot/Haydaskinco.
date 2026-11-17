"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SlidersHorizontal, X, ChevronDown } from "lucide-react"
import { type Product } from "@/lib/products"
import {
  ALL_CONCERNS,
  ALL_INGREDIENTS,
  ALL_SKIN_TYPES,
  resolveCatalogLabel,
  slugifyCatalogLabel,
} from "@/lib/catalog"
import { countProducts, queryProducts, type ProductQuery } from "@/lib/supabase/products"
import { getActiveBrands } from "@/lib/supabase/brands"
import {
  getCategoryTree,
  resolveCategoryName,
  slugifyCategory,
  type CategorySection,
} from "@/lib/supabase/categories"
import { CategorySelect } from "@/components/category-select"
import { ProductCard } from "@/components/product-card"
import { cn } from "@/lib/utils"

const SORT_OPTIONS = [
  { label: "Featured",     value: "featured" },
  { label: "Price: Low–High", value: "price-asc" },
  { label: "Price: High–Low", value: "price-desc" },
  { label: "Best Rated",   value: "rating" },
  { label: "Most Reviews", value: "reviews" },
]

/** Slider end. At this value the control means “all prices” and is not sent as priceMax. */
const PRICE_CEILING = 1_000_000

/** Products fetched per page on the shop grid ("Load more" fetches the next page). */
const PAGE_SIZE = 96

function resolveShopCategory(tree: CategorySection[], slugOrName: string) {
  const direct = resolveCategoryName(tree, slugOrName)
  if (direct) return direct
  let decoded = slugOrName.trim()
  try {
    decoded = decodeURIComponent(slugOrName).trim()
  } catch {
    /* keep the raw param */
  }
  const needle = slugifyCategory(decoded).replace(/-and-/g, "-")
  if (!needle) return null
  const match = tree.flatMap(section => section.categories).find(cat => {
    const slug = slugifyCategory(cat.slug).replace(/-and-/g, "-")
    const name = slugifyCategory(cat.name).replace(/-and-/g, "-")
    return slug === needle || name === needle
  })
  return match?.name ?? null
}

export function ShopGrid({
  initialProducts,
  initialCategory = "All",
}: {
  initialProducts?: Product[]
  /** Already-resolved display name from the server (not a URL slug). */
  initialCategory?: string
}) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const urlCategory = searchParams.get("category") ?? "All"
  const urlBrand = searchParams.get("brand") ?? "All"
  const urlSkinType = searchParams.get("skinType") ?? "All"
  const urlFilter = searchParams.get("filter")
  const saleOnly = searchParams.get("sale") === "true"

  const [categoryTree, setCategoryTree] = useState<CategorySection[]>([])
  const [category, setCategory]   = useState(initialCategory)
  const [brand, setBrand]         = useState(urlBrand === "All" || !urlBrand ? "All" : urlBrand)
  const [concern, setConcern]     = useState("All")
  const [ingredient, setIngredient] = useState("All")
  const [skinType, setSkinType]   = useState(
    urlSkinType === "All" || !urlSkinType
      ? "All"
      : resolveCatalogLabel(ALL_SKIN_TYPES, urlSkinType) ?? decodeURIComponent(urlSkinType),
  )
  const [sort, setSort]           = useState("featured")
  const [filtersOpen, setFiltersOpen] = useState(
    urlFilter === "concerns" || urlFilter === "ingredients",
  )
  const [priceMax, setPriceMax]   = useState(PRICE_CEILING)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [minRating, setMinRating]     = useState(0)
  const [filtered, setFiltered] = useState<Product[]>(initialProducts ?? [])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState((initialProducts?.length ?? 0) >= PAGE_SIZE)
  const [total, setTotal] = useState<number | null>(null)
  const [activeQuery, setActiveQuery] = useState<ProductQuery | null>(null)
  const [brandNames, setBrandNames] = useState<string[]>([])
  const [concernOptions, setConcernOptions] = useState<string[]>([...ALL_CONCERNS])
  const [ingredientOptions, setIngredientOptions] = useState<string[]>([...ALL_INGREDIENTS])
  const [treeReady, setTreeReady] = useState(false)

  const priceFiltered = priceMax < PRICE_CEILING

  useEffect(() => {
    getCategoryTree().then(tree => {
      setCategoryTree(tree)
      setTreeReady(true)
    })
    getActiveBrands().then(list => setBrandNames(list.map(b => b.name)))
    void import("@/lib/supabase/catalog").then(({ getCatalogNames }) => {
      getCatalogNames("concerns").then(n => { if (n.length) setConcernOptions(n) })
      getCatalogNames("ingredients").then(n => { if (n.length) setIngredientOptions(n) })
    })
  }, [])

  useEffect(() => {
    if (urlFilter !== "concerns" && urlFilter !== "ingredients") return
    setFiltersOpen(true)
    const key = urlFilter === "concerns" ? "concern" : "ingredient"
    const timer = window.setTimeout(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-shop-filter="${key}"]`))
      const visible = nodes.find(node => node.getClientRects().length > 0)
      visible?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [urlFilter])

  useEffect(() => {
    if (!filtersOpen) return
    const mq = window.matchMedia("(min-width: 1024px)")
    if (mq.matches) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [filtersOpen])

  // Keep filters in sync when navigating via navbar (/shop?category=… / ?brand=… / ?skinType=…)
  useEffect(() => {
    setBrand(urlBrand === "All" || !urlBrand ? "All" : urlBrand)

    if (urlCategory === "All" || !urlCategory) {
      setCategory("All")
    } else if (treeReady) {
      const resolved = resolveShopCategory(categoryTree, urlCategory)
      if (resolved) setCategory(resolved)
    }

    if (urlSkinType === "All" || !urlSkinType) {
      setSkinType("All")
    } else {
      setSkinType(resolveCatalogLabel(ALL_SKIN_TYPES, urlSkinType) ?? decodeURIComponent(urlSkinType))
    }
  }, [urlCategory, urlBrand, urlSkinType, categoryTree, treeReady])

  // Query Supabase with filters (DB-level), not client-side array filtering
  useEffect(() => {
    // URL category is a slug; wait until the tree can resolve it to a display name
    // so we never query with `body-moisturizers-oils` against name-based DB values.
    const urlNeedsResolve = Boolean(urlCategory && urlCategory !== "All")
    if (urlNeedsResolve && !treeReady) return

    let cancelled = false
    setLoading(true)

    const categoryName =
      category === "All"
        ? "All"
        : (resolveCategoryName(categoryTree, category) ??
            (treeReady ? "All" : category))

    const q: ProductQuery = {
      category: categoryName,
      brand,
      concern,
      ingredient,
      skinType,
      discountOnly: saleOnly || undefined,
      ...(priceFiltered ? { priceMax } : {}),
      inStockOnly,
      minRating,
      sort,
    }
    setActiveQuery(q)
    setTotal(null)
    countProducts(q).then(n => {
      if (!cancelled) setTotal(n)
    })
    queryProducts({ ...q, limit: PAGE_SIZE }).then(list => {
      if (cancelled) return
      setFiltered(list)
      setHasMore(list.length >= PAGE_SIZE)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [category, brand, concern, ingredient, skinType, sort, priceMax, priceFiltered, inStockOnly, minRating, categoryTree, treeReady, urlCategory, saleOnly])

  async function loadMore() {
    if (!activeQuery || loadingMore) return
    setLoadingMore(true)
    try {
      const next = await queryProducts({ ...activeQuery, limit: PAGE_SIZE, offset: filtered.length })
      setFiltered(prev => {
        const seen = new Set(prev.map(p => p.id))
        return [...prev, ...next.filter(p => !seen.has(p.id))]
      })
      setHasMore(next.length >= PAGE_SIZE)
    } finally {
      setLoadingMore(false)
    }
  }

  const shownCount = total ?? filtered.length

  const activeCount = [
    category !== "All", brand !== "All", concern !== "All",
    ingredient !== "All", skinType !== "All",
    priceFiltered, inStockOnly, minRating > 0, saleOnly,
  ].filter(Boolean).length

  function writeQuery(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }

  function applyCategory(name: string) {
    setCategory(name)
    writeQuery(params => {
      if (name === "All") {
        params.delete("category")
        return
      }
      const slug = categoryTree.flatMap(section => section.categories).find(cat => cat.name === name)?.slug
      params.set("category", slug ?? name)
    })
  }

  function applyBrand(name: string) {
    setBrand(name)
    writeQuery(params => {
      if (name === "All") params.delete("brand")
      else params.set("brand", name)
    })
  }

  function applySkinType(name: string) {
    setSkinType(name)
    writeQuery(params => {
      if (name === "All") params.delete("skinType")
      else params.set("skinType", slugifyCatalogLabel(name))
    })
  }

  function clearAll() {
    setCategory("All"); setBrand("All"); setConcern("All")
    setIngredient("All"); setSkinType("All")
    setPriceMax(PRICE_CEILING); setInStockOnly(false); setMinRating(0)
    setFiltersOpen(false)
    router.replace("/shop", { scroll: false })
  }

  const filterFields = (stacked = false) => (
      <div className={cn(stacked ? "flex flex-col gap-5" : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
        <div>
          <p className="mb-2 text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Category</p>
          <div className="relative">
            <CategorySelect
              value={category}
              onChange={applyCategory}
              tree={categoryTree}
              includeAll
              className="w-full appearance-none border border-border bg-background px-3 py-2.5 pr-8 text-xs font-light outline-none focus:border-foreground transition-colors cursor-pointer"
            />
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          </div>
        </div>
        <FilterSelect label="Brand" value={brand} onChange={applyBrand} options={["All", ...brandNames]} />
        <FilterSelect
          label="Concern"
          value={concern}
          onChange={setConcern}
          options={["All", ...concernOptions]}
          filterKey="concern"
          highlighted={urlFilter === "concerns"}
        />
        <FilterSelect
          label="Ingredient"
          value={ingredient}
          onChange={setIngredient}
          options={["All", ...ingredientOptions]}
          filterKey="ingredient"
          highlighted={urlFilter === "ingredients"}
        />
        <FilterSelect label="Skin Type" value={skinType} onChange={applySkinType} options={["All", ...ALL_SKIN_TYPES]} />
        <div>
          <p className="mb-2 text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Min Rating</p>
          <div className="flex items-center gap-1">
            {[0, 3, 3.5, 4, 4.5].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setMinRating(r)}
                className={cn(
                  "flex-1 border py-1.5 text-[10px] font-light transition-all",
                  minRating === r
                    ? "border-gold bg-lavender text-gold"
                    : "border-border text-muted-foreground hover:border-gold/60",
                )}
              >
                {r === 0 ? "All" : `${r}+`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">
            {priceFiltered ? `Max price: ₦${priceMax.toLocaleString("en-NG")}` : "Max price: All prices"}
          </p>
          <input
            type="range"
            min={1000}
            max={PRICE_CEILING}
            step={1000}
            value={priceMax}
            onChange={e => setPriceMax(Number(e.target.value))}
            aria-label="Maximum price"
            className="w-full accent-gold"
          />
          <div className="mt-1 flex justify-between text-[10px] font-light text-muted-foreground">
            <span>₦1,000</span><span>₦1,000,000</span>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} className="accent-gold" />
            <span className="text-xs font-light">In stock only</span>
          </label>
        </div>
      </div>
    )

  const chips = ([
    category !== "All" && { label: category, clear: () => applyCategory("All") },
    brand !== "All"    && { label: brand,    clear: () => applyBrand("All") },
    concern !== "All"  && { label: concern,  clear: () => setConcern("All") },
    ingredient !== "All" && { label: ingredient, clear: () => setIngredient("All") },
    skinType !== "All" && { label: skinType, clear: () => applySkinType("All") },
    saleOnly           && { label: "On sale", clear: () => writeQuery(params => { params.delete("sale") }) },
    priceFiltered      && { label: `Max ₦${priceMax.toLocaleString("en-NG")}`, clear: () => setPriceMax(PRICE_CEILING) },
    inStockOnly        && { label: "In stock", clear: () => setInStockOnly(false) },
    minRating > 0      && { label: `${minRating}★+`, clear: () => setMinRating(0) },
  ].filter(Boolean) as { label: string; clear: () => void }[])

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-10">
        <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto lg:block">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground">Filters</p>
          {filterFields(true)}
        </aside>

        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFiltersOpen(v => !v)}
                className={cn(
                  "flex items-center gap-2 border px-4 py-2.5 text-xs font-medium uppercase tracking-[0.12em] transition-all lg:hidden",
                  filtersOpen ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground",
                )}
              >
                <SlidersHorizontal className="size-3.5" />
                Filters
                {activeCount > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-gold text-[9px] font-bold text-gold-foreground">{activeCount}</span>
                )}
              </button>
              {activeCount > 0 && (
                <button type="button" onClick={clearAll} className="flex items-center gap-1 text-xs font-light text-muted-foreground transition-colors hover:text-foreground">
                  <X className="size-3.5" /> Clear all
                </button>
              )}
              <p className="text-xs font-light text-muted-foreground">
                {loading ? "Loading…" : `${shownCount} product${shownCount !== 1 ? "s" : ""}`}
              </p>
            </div>

            <div className="relative">
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="cursor-pointer appearance-none border border-border bg-background px-4 py-2.5 pr-8 text-xs font-light outline-none transition-colors focus:border-foreground"
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {filtersOpen && (
            <div className="lg:hidden">
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setFiltersOpen(false)}
                className="atelier-menu fixed inset-0 z-[60] bg-foreground/30"
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Filters"
                className="atelier-menu fixed inset-y-0 left-0 z-[70] flex w-[min(100%,22rem)] flex-col bg-background shadow-[0_16px_40px_-24px_rgba(41,48,73,0.45)]"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em]">Filters</p>
                  <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="text-muted-foreground">
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {filterFields(true)}
                </div>
                <div className="border-t border-border p-4">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="w-full bg-foreground py-3.5 text-xs font-medium uppercase tracking-[0.16em] text-background"
                  >
                    {loading ? "Show products" : `Show ${shownCount} product${shownCount === 1 ? "" : "s"}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeCount > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {chips.map(chip => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.clear}
                  className="flex items-center gap-1.5 border border-gold/40 bg-lavender px-3 py-1 text-[11px] font-light text-gold transition-all hover:bg-secondary"
                >
                  {chip.label} <X className="size-3" />
                </button>
              ))}
            </div>
          )}

          {loading && filtered.length === 0 ? (
            <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="aspect-square animate-pulse bg-muted/40" />
                  <div className="h-3 w-2/3 animate-pulse bg-muted/40" />
                  <div className="h-3 w-1/3 animate-pulse bg-muted/30" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="font-serif text-2xl font-medium text-muted-foreground">No products match your filters.</p>
              <button type="button" onClick={clearAll} className="mt-4 text-sm font-light text-gold underline underline-offset-2">
                Clear all filters
              </button>
            </div>
          ) : (
            <div className={cn("atelier-shop-grid grid grid-cols-2 items-start gap-x-5 gap-y-10 sm:grid-cols-3 xl:grid-cols-4", loading && "opacity-60")}>
              {filtered.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}

          {!loading && filtered.length > 0 && hasMore && (
            <div className="mt-14 flex flex-col items-center gap-3">
              <p className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">
                Showing {filtered.length}{total != null ? ` of ${total}` : ""} products
              </p>
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="border border-foreground px-10 py-3.5 text-xs font-medium uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options, filterKey, highlighted }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  filterKey?: string
  highlighted?: boolean
}) {
  return (
    <div
      data-shop-filter={filterKey}
      className={cn(highlighted && "ring-1 ring-gold ring-offset-2")}
    >
      <p className="mb-2 text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full cursor-pointer appearance-none border border-border bg-background px-3 py-2.5 pr-8 text-xs font-light outline-none transition-colors focus:border-foreground"
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  )
}
