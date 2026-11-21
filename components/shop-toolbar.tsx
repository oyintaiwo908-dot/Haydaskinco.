import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/field"

export const SORT_OPTIONS = [
  { label: "Featured",     value: "featured" },
  { label: "Price: Low–High", value: "price-asc" },
  { label: "Price: High–Low", value: "price-desc" },
  { label: "Best Rated",   value: "rating" },
  { label: "Most Reviews", value: "reviews" },
]

type ShopToolbarProps = {
  countLabel: string
  activeCount?: number
  sort?: string
  onSort?: (value: string) => void
  onOpenFilters?: () => void
  /**
   * Static placeholder for the /shop Suspense fallback: same markup and height as the live
   * toolbar so the grid does not move when ShopGrid takes over, but not focusable or announced.
   */
  placeholder?: boolean
}

/**
 * Filters button, product count and sort. Phones: Filters and Sort share one row, the count
 * sits under them. From `sm` up: count on the left, sort on the right.
 */
export function ShopToolbar({ countLabel, activeCount = 0, sort = "featured", onSort, onOpenFilters, placeholder }: ShopToolbarProps) {
  const sortId = placeholder ? undefined : "shop-sort"
  return (
    <div
      className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2"
      {...(placeholder ? { inert: true, "aria-hidden": true } : {})}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenFilters}
        aria-haspopup="dialog"
        className="h-10 flex-1 sm:flex-none lg:hidden"
      >
        <SlidersHorizontal aria-hidden />
        Filters
        {activeCount > 0 && (
          <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-2 sm:order-last sm:flex-none">
        <label htmlFor={sortId} className="sr-only text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground sm:not-sr-only">
          Sort
        </label>
        <div className="min-w-0 flex-1 sm:w-48 sm:flex-none">
          {placeholder ? (
            <Select defaultValue={sort} className="h-10 text-sm" tabIndex={-1}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ) : (
            <Select id={sortId} value={sort} onChange={e => onSort?.(e.target.value)} className="h-10 text-sm">
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          )}
        </div>
      </div>

      <p className="w-full text-sm text-muted-foreground sm:w-auto sm:flex-1" aria-live={placeholder ? undefined : "polite"}>
        {countLabel}
      </p>
    </div>
  )
}
