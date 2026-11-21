"use client"

import "./globals.css"
import { ErrorPanel } from "@/components/error-panel"

/** Replaces the root layout when it fails, so it brings its own <html>, <body> and styles. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" className="light bg-background">
      <body className="font-sans antialiased">
        <ErrorPanel digest={error.digest} onRetry={reset} />
      </body>
    </html>
  )
}
