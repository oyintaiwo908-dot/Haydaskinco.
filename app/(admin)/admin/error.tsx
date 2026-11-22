"use client"

import { ErrorPanel } from "@/components/error-panel"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorPanel
      title="This admin page hit an error"
      description="Your changes may not have been saved. Try again; if it keeps happening, note the reference below."
      digest={error.digest}
      onRetry={reset}
      homeHref="/admin"
      homeLabel="Back to dashboard"
    />
  )
}
