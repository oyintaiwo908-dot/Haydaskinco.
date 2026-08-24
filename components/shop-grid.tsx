"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { SlidersHorizontal, X, ChevronDown } from "lucide-react"
import { type Product } from "@/lib/products"
import {
  ALL_CONCERNS,
  ALL_INGREDIENTS,
  ALL_SKIN_TYPES,
  resolveCatalogLabel,
} from "@/lib/catalog"
import { queryProducts } from "@/lib/supabase/products"
import { getActiveBrands } from "@/lib/supabase/brands"
import {
  getCategoryTree,
  resolveCategoryName,
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

export function ShopGrid({
  initialProducts,
  initialCategory = "All",
}: {
  initialProducts?: Product[]
  /** Already-resolved display name from the server (not a URL slug). */
  initialCategory?: string
}) {
  const searchParams = useSearchParams()
  const urlCategory = searchParams.get("category") ?? "All"
  const urlBrand = searchParams.get("brand") ?? "All"
  const urlSkinType = searchParams.get("skinType") ?? "All"

  const [categoryTree, setCategoryTree] = useState<CategorySection[]>([])
  const [category, setCategory]   = useState(initialCategory)
  const [brand, setBrand]         = useState(urlBrand)
  const [concern, setConcern]     = useState("All")
  const [ingredient, setIngredient] = useState("All")
  const [skinType, setSkinType]   = useState("All")
  const [sort, setSort]           = useState("featured")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [priceMax, setPriceMax]   = useState(50000)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [minRating, setMinRating]     = useState(0)
  const [filtered, setFiltered] = useState<Product[]>(initialProducts ?? [])
  const [loading, setLoading] = useState(false)
  const [brandNames, setBrandNames] = useState<string[]>([])
  const [concernOptions, setConcernOptions] = useState<string[]>([...ALL_CONCERNS])
  const [ingredientOptions, setIngredientOptions] = useState<string[]>([...ALL_INGREDIENTS])
  const [treeReady, setTreeReady] = useState(false)

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

  // Keep filters in sync when navigating via navbar (/shop?category=… / ?brand=… / ?skinType=…)
  useEffect(() => {
    setBrand(urlBrand === "All" || !urlBrand ? "All" : urlBrand)

    if (urlCategory === "All" || !urlCategory) {
      setCategory("All")
    } else if (treeReady) {
      const resolved = resolveCategoryName(categoryTree, urlCategory)
      // Only apply once we can resolve slug → display name
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

    queryProducts({
      category: categoryName,
      brand,
      concern,
      ingredient,
      skinType,
      priceMax,
      inStockOnly,
      minRating,
      sort,
      limit: 96,
    }).then(list => {
      if (!cancelled) setFiltered(list)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [category, brand, concern, ingredient, skinType, sort, priceMax, inStockOnly, minRating, categoryTree, treeReady, urlCategory])

  const activeCount = [
    category !== "All", brand !== "All", concern !== "All",
    ingredient !== "All", skinType !== "All",
    priceMax < 50000, inStockOnly, minRating > 0,
  ].filter(Boolean).length

  function clearAll() {
    setCategory("All"); setBrand("All"); setConcern("All")
    setIngredient("All"); setSkinType("All")
    setPriceMax(50000); setInStockOnly(false); setMinRating(0)
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFiltersOpen(v => !v)}
            className={cn(
              "flex items-center gap-2 border px-4 py-2.5 text-xs font-medium uppercase tracking-[0.12em] transition-all",
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
            <button type="button" onClick={clearAll} className="flex items-center gap-1 text-xs font-light text-muted-foreground hover:text-foreground transition-colors">
              <X className="size-3.5" /> Clear all
            </button>
          )}
          <p className="text-xs font-light text-muted-foreground">
            {loading ? "Loading…" : `${filtered.length} product${filtered.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="appearance-none border border-border bg-background px-4 py-2.5 pr-8 text-xs font-light outline-none focus:border-foreground transition-colors cursor-pointer"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <div className="mb-8 grid gap-6 border border-border bg-secondary p-4 sm:p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div>
            <p className="mb-2 text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Category</p>
            <div className="relative">
              <CategorySelect
                value={category}
                onChange={setCategory}
                tree={categoryTree}
                includeAll
                className="w-full appearance-none border border-border bg-background px-3 py-2.5 pr-8 text-xs font-light outline-none focus:border-foreground transition-colors cursor-pointer"
              />
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            </div>
          </div>
          <FilterSelect label="Brand"      value={brand}      onChange={setBrand}      options={["All", ...brandNames]} />
          <FilterSelect label="Concern"    value={concern}    onChange={setConcern}    options={["All", ...concernOptions]} />
          <FilterSelect label="Ingredient" value={ingredient} onChange={setIngredient} options={["All", ...ingredientOptions]} />
          <FilterSelect label="Skin Type"  value={skinType}   onChange={setSkinType}   options={["All", ...ALL_SKIN_TYPES]} />
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
              Max Price: ₦{priceMax.toLocaleString()}
            </p>
            <input
              type="range" min={1000} max={50000} step={500}
              value={priceMax}
              onChange={e => setPriceMax(Number(e.target.value))}
              className="w-full accent-gold"
            />
            <div className="flex justify-between text-[10px] font-light text-muted-foreground mt-1">
              <span>₦1,000</span><span>₦50,000</span>
            </div>
            <label className="mt-3 flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} className="accent-gold" />
              <span className="text-xs font-light">In stock only</span>
            </label>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {activeCount > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {([
            category !== "All" && { label: category, clear: () => setCategory("All") },
            brand !== "All"    && { label: brand,    clear: () => setBrand("All") },
            concern !== "All"  && { label: concern,  clear: () => setConcern("All") },
            ingredient !== "All" && { label: ingredient, clear: () => setIngredient("All") },
            skinType !== "All" && { label: skinType, clear: () => setSkinType("All") },
            priceMax < 50000   && { label: `Max ₦${priceMax.toLocaleString()}`, clear: () => setPriceMax(50000) },
            inStockOnly        && { label: "In stock", clear: () => setInStockOnly(false) },
            minRating > 0      && { label: `${minRating}★+`, clear: () => setMinRating(0) },
          ].filter(Boolean) as { label: string; clear: () => void }[]).map(chip => (
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

      {/* Product grid */}
      {loading && filtered.length === 0 ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 md:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-square bg-muted/40 animate-pulse" />
              <div className="h-3 w-2/3 bg-muted/40 animate-pulse" />
              <div className="h-3 w-1/3 bg-muted/30 animate-pulse" />
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
        <div className={cn("grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 md:grid-cols-4", loading && "opacity-60 transition-opacity")}>
          {filtered.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none border border-border bg-background px-3 py-2.5 pr-8 text-xs font-light outline-none focus:border-foreground transition-colors cursor-pointer"
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
      </div>
    </div>
  )
}
