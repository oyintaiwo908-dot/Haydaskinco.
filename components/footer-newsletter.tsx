"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Footer sign-up form: the only interactive part of the footer. */
export function FooterNewsletter() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle")
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setError(null)
    setStatus("loading")
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "footer" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not subscribe. Please try again.")
        setStatus("idle")
        return
      }
      setStatus("done")
      setEmail("")
    } catch {
      setError("Could not subscribe. Please try again.")
      setStatus("idle")
    }
  }

  return (
    <form onSubmit={handleSubscribe} className="flex w-full max-w-md flex-col gap-2" noValidate={false}>
      <label htmlFor="footer-email" className="text-xs font-medium uppercase tracking-[0.14em] text-on-dark/80">
        Email address
      </label>
      <div className="flex gap-2">
        <input
          id="footer-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-describedby="footer-email-status"
          className="h-12 min-w-0 flex-1 rounded-control border border-on-dark/40 bg-transparent px-4 text-base text-on-dark placeholder:text-on-dark/60 hover:border-on-dark"
        />
        <Button type="submit" variant="light" disabled={status === "loading"}>
          {status === "loading" ? "Joining…" : "Join"}
        </Button>
      </div>
      <p id="footer-email-status" aria-live="polite" className="min-h-5 text-sm">
        {status === "done" && (
          <span className="inline-flex items-center gap-1.5 text-on-dark">
            <Check aria-hidden className="size-4" /> You&apos;re on the list.
          </span>
        )}
        {error && <span className="text-blush">{error}</span>}
      </p>
    </form>
  )
}
