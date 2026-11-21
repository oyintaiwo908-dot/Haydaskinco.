"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, ArrowLeft, Check } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const supabase = createClient()
    if (!supabase) {
      setError("Auth is not configured.")
      setLoading(false)
      return
    }

    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/reset-password`,
    })

    setLoading(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-160px)] max-w-md flex-col items-center justify-center px-5 py-12">
      <div className="mb-8 text-center">
        <p className="text-[11px] font-light uppercase tracking-[0.28em] text-gold mb-3">Account</p>
        <h1 className="font-serif text-4xl font-medium">Reset password</h1>
        <p className="mt-3 text-sm font-light text-muted-foreground">
          Enter your email and we’ll send a reset link via Supabase Auth.
        </p>
      </div>

      {sent ? (
        <div className="w-full border border-gold/40 bg-lavender px-6 py-10 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-gold text-gold-foreground">
            <Check className="size-5" />
          </span>
          <p className="mt-4 font-serif text-xl font-medium">Check your inbox</p>
          <p className="mt-2 text-sm font-light text-muted-foreground">
            If an account exists for {email}, you’ll receive a password reset email shortly.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-gold hover:underline"
          >
            <ArrowLeft className="size-3.5" /> Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="forgot-email" className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full border border-border bg-background py-3 pl-11 pr-4 text-sm font-light outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
              />
            </div>
          </div>
          {error && <p className="text-sm font-light text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-foreground py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-background transition-colors hover:bg-gold hover:text-gold-foreground disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 pt-2 text-xs font-light text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to sign in
          </Link>
        </form>
      )}
    </div>
  )
}
