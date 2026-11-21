"use client"

import { useLinkStatus } from "next/link"
import { cn } from "@/lib/utils"

/**
 * Thin progress line shown while a `prefetch={false}` link is navigating. Must render inside
 * a <Link>. Fixed size and always rendered, so it never shifts layout; it is positioned
 * against the nearest positioned ancestor (the product card).
 */
export function LinkPendingHint({ className }: { className?: string }) {
  const { pending } = useLinkStatus()
  return (
    <span
      aria-hidden
      className={cn(
        "link-pending pointer-events-none absolute inset-x-0 top-0 z-[4] h-0.5 origin-left bg-navy",
        pending ? "is-pending" : "opacity-0",
        className,
      )}
    />
  )
}
