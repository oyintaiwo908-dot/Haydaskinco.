"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

export function isCheckoutPath(pathname: string | null) {
  const path = (pathname ?? "").replace(/\/$/, "") || "/"
  return path === "/checkout" || path.startsWith("/checkout/")
}

/**
 * Hides storefront chrome (announcement bar, mega-nav, footer, chat and newsletter prompts)
 * on checkout so the payment flow is distraction-free. usePathname is a client hook: it does
 * not read request data on the server, so no route becomes dynamic.
 */
export function HideOnCheckout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (isCheckoutPath(pathname)) return null
  return <>{children}</>
}
