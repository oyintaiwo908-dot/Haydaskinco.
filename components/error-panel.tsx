"use client"

import Link from "next/link"
import { RotateCcw } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"

/**
 * Friendly error state for route error boundaries. Never renders the raw error message:
 * visitors see a short explanation and, when Next provides one, an opaque reference
 * (digest) that support can match against server logs.
 */
export function ErrorPanel({
  title = "Something went wrong",
  description = "Sorry, this page couldn't load. Please try again.",
  digest,
  onRetry,
  homeHref = "/",
  homeLabel = "Go to the homepage",
}: {
  title?: string
  description?: string
  digest?: string
  onRetry?: () => void
  homeHref?: string
  homeLabel?: string
}) {
  return (
    <div role="alert" className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-5 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-rose">Error</p>
      <h1 className="font-serif text-[clamp(2rem,1.6rem+1.6vw,3rem)] font-normal leading-tight text-navy-deep">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
      {digest && <p className="text-xs text-muted-foreground">Reference: <span className="font-mono">{digest}</span></p>}
      <div className="mt-2 flex flex-wrap gap-3">
        {onRetry && (
          <Button onClick={onRetry}>
            <RotateCcw aria-hidden /> Try again
          </Button>
        )}
        <Link href={homeHref} className={buttonVariants({ variant: "outline" })}>
          {homeLabel}
        </Link>
      </div>
    </div>
  )
}
