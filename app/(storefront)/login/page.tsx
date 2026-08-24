"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUserAuth } from "@/components/user-auth-provider"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const { session, ready, signIn } = useUserAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  // Already signed in → go to account (wait for auth hydrate)
  useEffect(() => {
    if (ready && session) router.replace("/account")
  }, [ready, session, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setUnconfirmed(false)
    setLoading(true)
    const err = await signIn(email, password)
    if (err === "email_not_confirmed") {
      setUnconfirmed(true)
      setLoading(false)
    } else if (err) {
      setError(err)
      setLoading(false)
    } else {
      router.push("/account")
    }
  }

  async function handleResend() {
    const supabase = createClient()
    if (!supabase || !email) return
    await supabase.auth.resend({ type: "signup", email })
    setResendSent(true)
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-160px)] max-w-md flex-col items-center justify-center px-5 py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <p className="text-[11px] font-light uppercase tracking-[0.28em] text-gold mb-3">Account</p>
        <h1 className="font-serif text-4xl font-medium">Welcome back</h1>
        <p className="mt-3 text-sm font-light text-muted-foreground">
          Sign in to view your orders, wishlists, and saved favourites.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full border border-border bg-background py-3 pl-11 pr-4 text-sm font-light outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">
              Password
            </label>
            <Link href="/forgot-password" className="text-[11px] font-light text-gold underline-offset-2 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full border border-border bg-background py-3 pl-11 pr-11 text-sm font-light outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/40"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {/* Email not confirmed */}
        {unconfirmed && (
          <div className="border border-gold/40 bg-lavender px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Please confirm your email before signing in.</p>
            <p className="text-[11px] font-light text-muted-foreground">
              Check your inbox for the confirmation link.
            </p>
            {resendSent ? (
              <p className="text-[11px] font-medium text-green-700">Confirmation email resent — check your inbox.</p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-[11px] font-medium text-gold underline-offset-2 hover:underline"
              >
                Resend confirmation email
              </button>
            )}
          </div>
        )}

        {/* Generic error */}
        {error && (
          <p className="text-xs text-muted-foreground bg-muted border border-border px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={cn(
            "flex w-full items-center justify-center gap-2 py-4 text-xs font-medium uppercase tracking-[0.18em] transition-all",
            loading
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-foreground text-background hover:bg-gold hover:text-gold-foreground",
          )}
        >
          {loading ? (
            <span className="size-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
          ) : (
            <>Sign In <ArrowRight className="size-3.5" /></>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="my-6 flex w-full items-center gap-4">
        <span className="flex-1 h-px bg-border" />
        <span className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">or</span>
        <span className="flex-1 h-px bg-border" />
      </div>

      {/* Guest checkout link */}
      <Link
        href="/checkout"
        className="w-full border border-border py-4 text-center text-xs font-light uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        Continue as Guest
      </Link>

      <p className="mt-8 text-center text-xs font-light text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-foreground underline-offset-2 hover:underline">
          Create one
        </Link>
      </p>

    </div>
  )
}
