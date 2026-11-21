"use client"

import { ErrorPanel } from "@/components/error-panel"

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorPanel digest={error.digest} onRetry={reset} />
}
