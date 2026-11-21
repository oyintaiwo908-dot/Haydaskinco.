"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronDown, X } from "lucide-react"
import { type Product } from "@/lib/products"
import {
  ALL_CONCERNS,
  ALL_INGREDIENTS,
  ALL_SKIN_TYPES,
  resolveCatalogLabel,
  slugifyCatalogLabel,
} from "@/lib/catalog"
import { countProducts, queryProducts } from "@/lib/supabase/products"
import { getActiveBrands } from "@/lib/supabase/brands"
import {
  getCategoryTree,
  resolveCategoryName,
  slugifyCategory,
  type CategorySection,
} from "@/lib/supabase/categories"
import { CategorySelect } from "@/components/category-select"
import { ProductCard } from "@/components/product-card"
import { ShopToolbar } from "@/components/shop-toolbar"
import { Sheet } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Field, Select } from "@/components/ui/field"
import { ProductGridSkeleton } from "@/components/ui/skeleton"
import { Money } from "@/components/ui/price"
import { cn } from "@/lib/utils"
import { prefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion"
import { useFlip } from "@/components/motion/use-flip"


/** Slider end. At this value the control means “all prices” and is not sent as priceMax. */
const PRICE_CEILING = 1_000_000

/** Products fetched per page on the shop grid ("Load more" fetches the next page). */
const PAGE_SIZE = 96

const NO_PRODUCTS: Product[] = []

const GRID = "grid grid-cols-2 items-start gap-x-3 gap-y-8 sm:grid-cols-3 md:gap-x-6 md:gap-y-12 xl:grid-cols-4"

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

function skinTypeFromUrl(urlSkinType: string) {
  return urlSkinType === "All" || !urlSkinType
    ? "All"
    : resolveCatalogLabel(ALL_SKIN_TYPES, urlSkinType) ?? decodeURIComponent(urlSkinType)
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
  const urlCategory = searchParams.get("category") ?? "All"
  const urlBrand = searchParams.get("brand") ?? "All"
  const urlSkinType = searchParams.get("skinType") ?? "All"
  const urlFilter = searchParams.get("filter")
  const saleOnly = searchParams.get("sale") === "true"

  const [categoryTree, setCategoryTree] = useState<CategorySection[]>([])
  const [treeReady, setTreeReady] = useState(false)
  const [category, setCategory]   = useState(initialCategory)
  const [brand, setBrand]         = useState(urlBrand === "All" || !urlBrand ? "All" : urlBrand)
  const [concern, setConcern]     = useState("All")
  const [ingredient, setIngredient] = useState("All")
  const [skinType, setSkinType]   = useState(skinTypeFromUrl(urlSkinType))
  const [sort, setSort]           = useState("featured")
  // Mobile filter sheet only; desktop shows the sidebar.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [priceMax, setPriceMax]   = useState(PRICE_CEILING)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [minRating, setMinRating]     = useState(0)
  const [brandNames, setBrandNames] = useState<string[]>([])
  const [concernOptions, setConcernOptions] = useState<string[]>([...ALL_CONCERNS])
  const [ingredientOptions, setIngredientOptions] = useState<string[]>([...ALL_INGREDIENTS])

  const priceFiltered = priceMax < PRICE_CEILING

  // Keep filters in sync when the URL changes (navbar links, back/forward). Adjusting state
  // during render on a changed key is React's recommended alternative to setState in an effect.
  const urlKey = `${urlCategory}|${urlBrand}|${urlSkinType}|${urlFilter}|${treeReady}`
  const [syncedUrlKey, setSyncedUrlKey] = useState(urlKey)
  if (syncedUrlKey !== urlKey) {
    setSyncedUrlKey(urlKey)
    setBrand(urlBrand === "All" || !urlBrand ? "All" : urlBrand)
    if (urlCategory === "All" || !urlCategory) {
      setCategory("All")
    } else if (treeReady) {
      const resolved = resolveShopCategory(categoryTree, urlCategory)
      if (resolved) setCategory(resolved)
    }
    setSkinType(skinTypeFromUrl(urlSkinType))
  }

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

  // ?filter=concerns|ingredients: open the sheet on phones, then bring that control into view.
  useEffect(() => {
    if (urlFilter !== "concerns" && urlFilter !== "ingredients") return
    const key = urlFilter === "concerns" ? "concern" : "ingredient"
    const mobile = window.matchMedia("(max-width: 1023px)").matches
    const openTimer = window.setTimeout(() => {
      if (mobile) setFiltersOpen(true)
    }, 80)
    const scrollTimer = window.setTimeout(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-shop-filter="${key}"]`))
      const visible = nodes.find(node => node.getClientRects().length > 0)
      visible?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" })
    }, 260)
    return () => {
      window.clearTimeout(openTimer)
      window.clearTimeout(scrollTimer)
    }
  }, [urlFilter])

  // The sheet is a modal; never leave it open behind the desktop layout.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)")
    const onChange = () => {
      if (desktop.matches) setFiltersOpen(false)
    }
    desktop.addEventListener("change", onChange)
    return () => desktop.removeEventListener("change", onChange)
  }, [])

  // URL category is a slug; wait until the tree can resolve it to a display name
  // so we never query with `body-moisturizers-oils` against name-based DB values.
  const urlNeedsResolve = Boolean(urlCategory && urlCategory !== "All")
  const categoryName =
    category === "All"
      ? "All"
      : (resolveCategoryName(categoryTree, category) ?? (treeReady ? "All" : category))
  const query = useMemo(
    () => ({
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
      limit: PAGE_SIZE,
    }),
    [categoryName, brand, concern, ingredient, skinType, saleOnly, priceFiltered, priceMax, inStockOnly, minRating, sort],
  )
  const queryKey = JSON.stringify(query)

  // /shop is static, so the server list is unfiltered: on a filtered URL start from the
  // skeleton instead of flashing every product before the filtered query returns.
  const startsFiltered =
    urlCategory !== "All" || urlBrand !== "All" || urlSkinType !== "All" || saleOnly
  const [result, setResult] = useState<{ key: string | null; list: Product[] }>(() => ({
    key: startsFiltered ? null : queryKey,
    list: startsFiltered ? [] : initialProducts ?? [],
  }))
  const loading = result.key !== queryKey
  const [total, setTotal] = useState<{ key: string; n: number } | null>(null)
  const [more, setMore] = useState<{ key: string; list: Product[]; done: boolean } | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  // Query Supabase with filters (DB-level), not client-side array filtering. The first run
  // also refreshes the ISR list silently (up to 1h old) without a loading state.
  useEffect(() => {
    if (urlNeedsResolve && !treeReady) return
    let cancelled = false
    queryProducts(query).then(list => {
      if (!cancelled) setResult({ key: queryKey, list })
    })
    countProducts(query).then(n => {
      if (!cancelled) setTotal({ key: queryKey, n })
    })
    return () => { cancelled = true }
  }, [query, queryKey, urlNeedsResolve, treeReady])

  // "Load more": extra pages for the current query, appended client-side (no server request).
  const extra = more?.key === queryKey ? more.list : NO_PRODUCTS
  const totalCount = total?.key === queryKey ? total.n : null

  async function loadMore() {
    if (loadingMore || loading) return
    const key = queryKey
    const offset = result.list.length + extra.length
    setLoadingMore(true)
    try {
      const next = await queryProducts({ ...query, offset })
      setMore(prev => {
        const base = prev?.key === key ? prev.list : []
        return { key, list: [...base, ...next], done: next.length < PAGE_SIZE }
      })
    } finally {
      setLoadingMore(false)
    }
  }

  // De-duplicate across pages in case the catalogue changed between requests.
  const filtered = useMemo(() => {
    if (extra.length === 0) return result.list
    const seen = new Set(result.list.map(p => p.id))
    return [...result.list, ...extra.filter(p => !seen.has(p.id) && seen.add(p.id))]
  }, [result.list, extra])
  const moreDone = more?.key === queryKey ? more.done : result.list.length < PAGE_SIZE
  const hasMore = !moreDone && (totalCount == null || filtered.length < totalCount)
  const shownCount = totalCount ?? filtered.length
  // Filter changes: cards that stay glide to their new places and new ones rise in. Never on
  // the first render: the server-rendered grid must not animate again when this takes over.
  const gridRef = useRef<HTMLDivElement>(null)
  useFlip(gridRef, filtered.map(p => p.id).join("|"), { enterNew: true })

  const activeCount = [
    category !== "All", brand !== "All", concern !== "All",
    ingredient !== "All", skinType !== "All",
    priceFiltered, inStockOnly, minRating > 0, saleOnly,
  ].filter(Boolean).length

  function writeQuery(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    const next = params.toString()
    // Native replaceState (not router.replace): updates useSearchParams without a server
    // round trip; router.replace re-requested the page from Vercel on every filter click.
    window.history.replaceState(null, "", next ? `${pathname}?${next}` : pathname)
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
    // Native replaceState: no server round trip (see writeQuery).
    window.history.replaceState(null, "", "/shop")
  }

  const countLabel = loading ? "Loading…" : `${shownCount} product${shownCount !== 1 ? "s" : ""}`

  /** `idPrefix` keeps ids unique: the fields render in the sidebar and in the mobile sheet. */
  const filterFields = (idPrefix: string) => (
    <div className="flex flex-col gap-5">
      <Field label="Category" id={`${idPrefix}-category`}>
        <div className="relative">
          <CategorySelect
            id={`${idPrefix}-category`}
            value={category}
            onChange={applyCategory}
            tree={categoryTree}
            includeAll
            className="h-12 w-full cursor-pointer appearance-none rounded-control border border-input bg-background px-4 pr-10 text-base text-foreground hover:border-navy"
          />
          <ChevronDown aria-hidden className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </Field>
      <Field label="Brand">
        <Select value={brand} onChange={e => applyBrand(e.target.value)}>
          {["All", ...brandNames].map(o => <option key={o} value={o}>{o}</option>)}
        </Select>
      </Field>
      <div data-shop-filter="concern" className={cn(urlFilter === "concerns" && "outline-2 outline-offset-4 outline-rose")}>
        <Field label="Concern">
          <Select value={concern} onChange={e => setConcern(e.target.value)}>
            {["All", ...concernOptions].map(o => <option key={o} value={o}>{o}</option>)}
          </Select>
        </Field>
      </div>
      <div data-shop-filter="ingredient" className={cn(urlFilter === "ingredients" && "outline-2 outline-offset-4 outline-rose")}>
        <Field label="Ingredient">
          <Select value={ingredient} onChange={e => setIngredient(e.target.value)}>
            {["All", ...ingredientOptions].map(o => <option key={o} value={o}>{o}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Skin type">
        <Select value={skinType} onChange={e => applySkinType(e.target.value)}>
          {["All", ...ALL_SKIN_TYPES].map(o => <option key={o} value={o}>{o}</option>)}
        </Select>
      </Field>
      <fieldset>
        <legend className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-foreground">Minimum rating</legend>
        <div className="grid grid-cols-5 gap-1">
          {[0, 3, 3.5, 4, 4.5].map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setMinRating(r)}
              aria-pressed={minRating === r}
              aria-label={r === 0 ? "Any rating" : `${r} stars and up`}
              className={cn(
                "h-11 rounded-control border text-sm transition-colors",
                minRating === r ? "border-navy bg-navy text-primary-foreground" : "border-input text-foreground hover:border-navy",
              )}
            >
              {r === 0 ? "All" : `${r}+`}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${idPrefix}-price`} className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-foreground">
          {priceFiltered ? <>Max price: <Money amount={priceMax} /></> : "Max price: any"}
        </label>
        <input
          id={`${idPrefix}-price`}
          type="range"
          min={1000}
          max={PRICE_CEILING}
          step={1000}
          value={priceMax}
          onChange={e => setPriceMax(Number(e.target.value))}
          className="h-11 w-full accent-navy"
        />
        <div className="flex justify-between text-xs text-muted-foreground" aria-hidden>
          <Money amount={1000} /><Money amount={PRICE_CEILING} />
        </div>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} className="size-5 accent-navy" />
        In stock only
      </label>
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
    minRating > 0      && { label: `${minRating}★ and up`, clear: () => setMinRating(0) },
  ].filter(Boolean) as { label: string; clear: () => void }[])

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 md:py-12 lg:px-8">
      <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-12">
        <aside aria-label="Filters" className="no-scrollbar sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto pb-6 lg:block">
          <p className="mb-5 font-serif text-2xl text-navy-deep">Filters</p>
          {filterFields("side")}
        </aside>

        <div className="min-w-0">
          <ShopToolbar
            countLabel={countLabel}
            activeCount={activeCount}
            sort={sort}
            onSort={setSort}
            onOpenFilters={() => setFiltersOpen(true)}
          />

          {activeCount > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {chips.map(chip => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.clear}
                  aria-label={`Remove filter: ${chip.label}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-navy/20 bg-secondary px-3 text-sm text-navy-deep transition-colors hover:border-navy"
                >
                  {chip.label} <X aria-hidden className="size-3.5" />
                </button>
              ))}
              <button type="button" onClick={clearAll} className="min-h-9 px-2 text-sm text-navy underline underline-offset-4">
                Clear all
              </button>
            </div>
          )}

          {loading && filtered.length === 0 ? (
            <ProductGridSkeleton count={8} className={GRID} />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-start gap-4 border-t border-border py-16">
              <p className="font-serif text-2xl text-navy-deep">No products match these filters.</p>
              <Button variant="outline" onClick={clearAll}>Clear all filters</Button>
            </div>
          ) : (
            <div
              ref={gridRef}
              className={cn(GRID, "transition-opacity duration-300 ease-atelier", loading && "opacity-60")}
              aria-busy={loading}
            >
              {filtered.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}

          {!loading && filtered.length > 0 && hasMore && (
            <div className="mt-14 flex flex-col items-center gap-4">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Showing {filtered.length}{totalCount != null ? ` of ${totalCount}` : ""} products
              </p>
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filters */}
      <Sheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        side="bottom"
        title="Filters"
        className="lg:hidden"
        footer={
          <div className="flex gap-3">
            {activeCount > 0 && (
              <Button variant="outline" onClick={clearAll}>Clear</Button>
            )}
            <Button block onClick={() => setFiltersOpen(false)}>
              {loading ? "Show products" : `Show ${shownCount} product${shownCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        }
      >
        {filterFields("sheet")}
      </Sheet>
    </div>
  )
}
