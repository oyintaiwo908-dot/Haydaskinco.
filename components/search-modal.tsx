"use client"

import { useEffect, useRef, useState, createContext, useContext, useCallback, useMemo, type CSSProperties, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { Search, X, ArrowRight } from "lucide-react"
import { getEffectivePrice, type Product } from "@/lib/products"
import { searchProducts } from "@/lib/supabase/products"
import { Sheet } from "@/components/ui/sheet"
import { Price } from "@/components/ui/price"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/* ─── Context ──────────────────────────────────────────────── */
type SearchContextValue = {
  isSearchOpen: boolean
  openSearch: () => void
  closeSearch: () => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const openSearch = useCallback(() => setIsSearchOpen(true), [])
  const closeSearch = useCallback(() => setIsSearchOpen(false), [])

  // Cmd/Ctrl+K opens search from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const value = useMemo(() => ({ isSearchOpen, openSearch, closeSearch }), [isSearchOpen, openSearch, closeSearch])
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

export function useSearch() {
  const context = useContext(SearchContext)
  if (!context) throw new Error("useSearch must be used within SearchProvider")
  return context
}

/* ─── Modal ─────────────────────────────────────────────────── */
const CATEGORIES = ["All", "Serums", "Cleansers", "Moisturisers", "Toners", "Eye Care", "Sunscreen"]
const POPULAR = ["Niacinamide", "Sunscreen", "Vitamin C", "Cleanser", "CeraVe", "Hyaluronic acid"]
const SEARCH_DEBOUNCE_MS = 350
const SEARCH_TILES = [
  { label: "Serums", href: "/shop?category=serums-treatment", image: "/serum.jpeg" },
  { label: "Sunscreen", href: "/shop?category=sunscreens", image: "/sunscreen.jpeg" },
  { label: "Toners", href: "/shop?category=face-toners-mists", image: "/toner.jpeg" },
  { label: "Body", href: "/shop?category=body-moisturizers-oils", image: "/moisturizer.jpeg" },
]

export function SearchModal() {
  const { isSearchOpen, closeSearch } = useSearch()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [result, setResult] = useState<{ key: string; products: Product[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const requestKey = `${debouncedQuery}|${activeCategory}`
  const hasRequest = debouncedQuery !== "" || activeCategory !== "All"
  const typing = query.trim() !== debouncedQuery
  const loading = hasRequest && (typing || result?.key !== requestKey)
  const results = hasRequest && result ? result.products : []

  function close() {
    closeSearch()
    setQuery("")
    setDebouncedQuery("")
    setActiveCategory("All")
    setResult(null)
  }

  // Debounce text input so we don't hit the backend on every keystroke
  useEffect(() => {
    if (!isSearchOpen) return
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [query, isSearchOpen])

  useEffect(() => {
    if (!isSearchOpen || !hasRequest) return
    let cancelled = false
    searchProducts(debouncedQuery, activeCategory, 40).then(data => {
      if (!cancelled) setResult({ key: `${debouncedQuery}|${activeCategory}`, products: data })
    })
    return () => { cancelled = true }
  }, [isSearchOpen, hasRequest, debouncedQuery, activeCategory])

  return (
    <Sheet
      open={isSearchOpen}
      onOpenChange={open => { if (!open) close() }}
      side="top"
      title="Search products"
      hideTitle
      className="search-overlay"
      // Keep the close button on the content column instead of the viewport edge.
      headerClassName="pointer-events-none left-0 mx-auto max-w-5xl justify-end md:px-8 [&>button]:pointer-events-auto"
      bodyClassName="px-0 py-0"
    >
      <div className="mx-auto w-full max-w-5xl">
        {/* Focus shows as the rule under the field turning navy and thicker (the input opts out of the ring). */}
        <div className="flex items-center gap-3 border-b-2 border-navy/15 px-5 py-5 pr-16 transition-colors focus-within:border-navy md:px-8 md:py-8">
          <Search aria-hidden className="size-6 shrink-0 text-rose" strokeWidth={1.5} />
          <label htmlFor="site-search" className="sr-only">Search products, brands and ingredients</label>
          <input
            ref={inputRef}
            id="site-search"
            data-focus="custom"
            type="search"
            autoFocus
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Search products, brands, ingredients…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="h-14 min-w-0 flex-1 bg-transparent font-serif text-3xl text-navy-deep outline-none placeholder:text-muted-foreground md:h-16 md:text-5xl"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); inputRef.current?.focus() }}
              className="flex size-11 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-border px-5 py-3 md:px-8" role="group" aria-label="Filter by category">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              aria-pressed={activeCategory === cat}
              className={cn(
                "min-h-9 shrink-0 rounded-control border px-4 text-xs font-medium uppercase tracking-[0.12em] transition-colors",
                activeCategory === cat ? "border-navy bg-navy text-primary-foreground" : "border-input text-foreground hover:border-navy",
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* One persistent status region: only its text changes, so screen readers announce it reliably. */}
        <p className="sr-only" role="status" aria-live="polite">
          {!hasRequest
            ? ""
            : loading
              ? "Searching…"
              : results.length === 0
                ? "No results found"
                : `${results.length} result${results.length !== 1 ? "s" : ""}${debouncedQuery ? ` for ${debouncedQuery}` : ""}`}
        </p>
        <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto overscroll-contain px-5 py-6 md:max-h-[calc(100dvh-14rem)] md:px-8">
          {!hasRequest ? (
            <div className="grid gap-10 md:grid-cols-[1fr_1.2fr]">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-rose">Popular searches</p>
                <ul className="mt-4">
                  {POPULAR.map((term, i) => (
                    <li key={term} className="search-pop" style={{ "--i": i } as CSSProperties}>
                      <button
                        type="button"
                        onClick={() => { setQuery(term); inputRef.current?.focus() }}
                        className="group flex min-h-12 w-full items-center justify-between border-b border-navy/10 text-left font-serif text-2xl text-navy-deep transition-colors hover:text-rose md:text-3xl"
                      >
                        {term}
                        <ArrowRight aria-hidden className="size-4 -translate-x-2 opacity-0 transition-[translate,opacity] duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-rose">Shop a category</p>
                <ul className="mt-4 grid grid-cols-2 gap-3">
                  {SEARCH_TILES.map((tile, i) => (
                    <li key={tile.href} className="search-pop" style={{ "--i": i + 2 } as CSSProperties}>
                      {/* prefetch off: rendered only while search is open (Vercel CPU budget). */}
                      <Link href={tile.href} prefetch={false} onClick={close} className="group relative block aspect-[4/3] overflow-hidden bg-porcelain">
                        <Image src={tile.image} alt="" fill sizes="(max-width: 768px) 45vw, 22vw" className="object-cover transition-[scale] duration-700 ease-atelier group-hover:scale-105" />
                        <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-navy-deep/80 to-transparent" />
                        <span className="absolute bottom-3 left-3 font-serif text-xl text-on-dark">{tile.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : loading && results.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-start gap-3 py-10">
              <p className="font-serif text-2xl text-navy-deep">No results found</p>
              <p className="text-muted-foreground">Try a different word, or browse everything.</p>
              <Link href="/shop" onClick={close} className={buttonVariants({ variant: "link" })}>
                Browse all products <ArrowRight aria-hidden />
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground" aria-hidden>
                {loading ? "Updating…" : `${results.length} result${results.length !== 1 ? "s" : ""}`}
                {debouncedQuery && <> for &ldquo;{debouncedQuery}&rdquo;</>}
              </p>
              <ul className={cn("search-results grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5", loading && "opacity-60")}>
                {results.map((product, i) => (
                  <li key={product.id} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                    {/* prefetch off: up to 40 results per keystroke would each prefetch a product page (Vercel CPU budget). */}
                    <Link href={`/product/${product.id}`} prefetch={false} onClick={close} className="group block">
                      <span className="relative block aspect-4/5 overflow-hidden bg-porcelain">
                        <Image
                          src={product.image || "/placeholder.svg"}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 50vw, 20vw"
                          className="object-cover transition-transform duration-500 ease-atelier group-hover:scale-[1.04]"
                        />
                      </span>
                      <span className="mt-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{product.brand}</span>
                      <span className="mt-0.5 block font-serif text-lg leading-snug text-navy-deep group-hover:underline group-hover:underline-offset-4">
                        {product.name}
                      </span>
                      <Price amount={getEffectivePrice(product)} compareAt={product.discountPct ? product.price : null} size="sm" className="mt-1" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </Sheet>
  )
}
