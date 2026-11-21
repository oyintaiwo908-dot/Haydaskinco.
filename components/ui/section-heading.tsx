import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Eyebrow + title + optional description and action link, left-aligned by
 * default. `as` sets the heading level so pages keep a correct outline.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  as: Heading = "h2",
  align = "start",
  tone = "default",
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** e.g. a "View all" link; hidden on small screens is the caller's choice. */
  action?: ReactNode
  as?: "h1" | "h2" | "h3"
  align?: "start" | "center"
  /** `on-dark` for navy bands. */
  tone?: "default" | "on-dark"
  className?: string
}) {
  const onDark = tone === "on-dark"
  return (
    <div
      className={cn(
        "flex gap-4",
        align === "center" ? "flex-col items-center text-center" : "flex-wrap items-end justify-between",
        className,
      )}
    >
      <div className={cn("min-w-0", align === "center" && "flex flex-col items-center")}>
        {eyebrow && (
          <p className={cn("text-xs font-medium uppercase tracking-[0.18em]", onDark ? "text-blush" : "text-rose")}>
            {eyebrow}
          </p>
        )}
        <Heading
          className={cn(
            "font-serif font-normal leading-[1.08] tracking-[-0.01em] text-balance",
            Heading === "h1" ? "text-[clamp(2rem,1.6rem+1.6vw,3rem)]" : "text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)]",
            eyebrow && "mt-2",
            onDark ? "text-on-dark" : "text-navy-deep",
          )}
        >
          {/* Rises through a mask as it scrolls into view (globals.css .heading-mask). */}
          <span className="heading-mask">
            <span>{title}</span>
          </span>
        </Heading>
        {description && (
          <p className={cn("mt-3 max-w-prose text-base", onDark ? "text-on-dark/80" : "text-muted-foreground")}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
