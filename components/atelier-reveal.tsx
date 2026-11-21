import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Scroll reveal wrapper. Server-rendered and visible by default: the rise-in
 * is a CSS scroll-driven animation (`.atelier-reveal` in globals.css) that
 * only runs where `animation-timeline: view()` is supported and motion is not
 * reduced. No client JS, so content never waits for hydration.
 */
export function AtelierReveal({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("atelier-reveal", className)}>{children}</div>
}
