import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Native <details> accordion: keyboard operable, find-in-page friendly, no JS.
 * Give several the same `name` to make them exclusive (one open at a time)
 * where supported. Height animates via CSS where interpolate-size exists.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  name,
  className,
  summaryClassName,
  contentClassName,
}: {
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  name?: string
  className?: string
  summaryClassName?: string
  contentClassName?: string
}) {
  return (
    <details name={name} open={defaultOpen || undefined} className={cn("disclosure group border-b border-border", className)}>
      <summary
        className={cn(
          "flex min-h-12 cursor-pointer items-center justify-between gap-4 py-3 text-sm font-medium uppercase tracking-[0.14em] text-foreground",
          summaryClassName,
        )}
      >
        <span>{summary}</span>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-atelier group-open:rotate-180"
        />
      </summary>
      <div className={cn("pb-5 text-[15px] leading-relaxed text-muted-foreground", contentClassName)}>{children}</div>
    </details>
  )
}
