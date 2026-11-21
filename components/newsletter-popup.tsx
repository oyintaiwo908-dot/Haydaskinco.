"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Check } from "lucide-react"
import { Sheet } from "@/components/ui/sheet"
import { Field, Input } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { isCheckoutPath } from "@/components/hide-on-checkout"

const STORAGE_KEY = "hayda_newsletter_dismissed"
const DELAY_MS = 20_000
const RETRY_MS = 10_000

function wasDismissed() {
  try {
    return Boolean(sessionStorage.getItem(STORAGE_KEY))
  } catch {
    return true
  }
}
function rememberDismissed() {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1")
  } catch {
    /* storage blocked: the popup simply may show again */
  }
}

export function NewsletterPopup() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onCheckout = isCheckoutPath(pathname)

  useEffect(() => {
    if (onCheckout || wasDismissed()) return
    let t: number | undefined
    // Never interrupt: wait while another dialog is open or the visitor is typing.
    const tryOpen = () => {
      if (wasDismissed()) return
      const busy =
        document.querySelector("dialog[open]") !== null ||
        (document.activeElement instanceof HTMLElement &&
          document.activeElement.matches("input, textarea, select, [contenteditable='true']"))
      if (busy) {
        t = window.setTimeout(tryOpen, RETRY_MS)
        return
      }
      setOpen(true)
    }
    t = window.setTimeout(tryOpen, DELAY_MS)
    return () => window.clearTimeout(t)
  }, [onCheckout])

  function handleOpenChange(next: boolean) {
    if (!next) rememberDismissed()
    setOpen(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "popup" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not subscribe. Please try again.")
        return
      }
      setSubmitted(true)
      rememberDismissed()
    } catch {
      setError("Could not subscribe. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet
      open={open && !onCheckout}
      onOpenChange={handleOpenChange}
      side="center"
      title="Early access to new arrivals"
      description="Join the HAYDA list for a first look at new arrivals and notes from the Journal."
    >
      {submitted ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-navy">
            <Check aria-hidden className="size-6" />
          </span>
          <p className="font-medium">You&apos;re on the list.</p>
          <p className="text-sm text-muted-foreground">Check your inbox for your welcome email and 10% off your first order.</p>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Email address" error={error ?? undefined} required>
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Button type="submit" block disabled={loading}>
            {loading ? "Subscribing…" : "Subscribe"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            No spam. Unsubscribe any time.{" "}
            <button type="button" onClick={() => handleOpenChange(false)} className="underline underline-offset-2 hover:text-foreground">
              No thanks
            </button>
          </p>
        </form>
      )}
    </Sheet>
  )
}
