"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { isStoreManagerRole } from "@/lib/auth"
import { useUserAuth } from "@/components/user-auth-provider"
import { createAdminBrowserClient, createClient } from "@/lib/supabase/client"
import { SuspendedAccountDialog, SUSPENDED_AUTH_CODE, SUSPENDED_NOTICE_KEY } from "@/components/suspended-account-dialog"

function BrandPanel() {
  return (
    <aside className="hidden min-w-0 flex-col justify-between bg-gold px-8 py-14 text-gold-foreground md:flex lg:px-12 lg:py-16">
      <p className="font-serif text-2xl font-medium tracking-[0.12em]">HAYDA SKINCo.</p>
      <ul className="space-y-8">
        <li>
          <p className="font-serif text-3xl font-medium leading-tight">Authentic products</p>
          <p className="mt-2 max-w-xs text-sm font-light leading-relaxed text-gold-foreground/80">
            Sourced from authorised distributors.
          </p>
        </li>
        <li>
          <p className="font-serif text-3xl font-medium leading-tight">Free standard delivery</p>
          <p className="mt-2 max-w-xs text-sm font-light leading-relaxed text-gold-foreground/80">
            Nationwide, in 5–7 business days.
          </p>
        </li>
        <li>
          <p className="font-serif text-3xl font-medium leading-tight">Rewards</p>
          <p className="mt-2 max-w-xs text-sm font-light leading-relaxed text-gold-foreground/80">
            1 point per ₦100 spent.
          </p>
        </li>
      </ul>
      <p className="text-[11px] font-light uppercase tracking-[0.22em] text-gold-foreground/70">
        Lagos, Nigeria
      </p>
    </aside>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const { session, ready, signIn } = useUserAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [suspendedOpen, setSuspendedOpen] = useState(false)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const submitLock = useRef(false)

  useEffect(() => {
    if (sessionStorage.getItem(SUSPENDED_NOTICE_KEY) === "1") {
      sessionStorage.removeItem(SUSPENDED_NOTICE_KEY)
      setSuspendedOpen(true)
    }
    const params = new URLSearchParams(window.location.search)
    if (params.get("suspended") === "1") setSuspendedOpen(true)
  }, [])

  // Already signed in. Store managers go to the admin area; customers go to account.
  useEffect(() => {
    if (!ready || !session || submitLock.current) return
    router.replace(isStoreManagerRole(session.role) ? "/admin/dashboard" : "/account")
  }, [ready, session, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setUnconfirmed(false)
    setLoading(true)
    submitLock.current = true
    const err = await signIn(email, password)
    if (err === SUSPENDED_AUTH_CODE) {
      submitLock.current = false
      setSuspendedOpen(true)
      setLoading(false)
    } else if (err === "email_not_confirmed") {
      submitLock.current = false
      setUnconfirmed(true)
      setLoading(false)
    } else if (err) {
      submitLock.current = false
      setError(err)
      setLoading(false)
    } else {
      const supabase = createClient()
      const { data: { user } } = supabase
        ? await supabase.auth.getUser()
        : { data: { user: null } }
      let role: string | null = null
      if (supabase && user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle()
        role = profile?.role ?? null
      }
      if (isStoreManagerRole(role)) {
        const admin = createAdminBrowserClient()
        if (admin) {
          const { error: adminError } = await admin.auth.signInWithPassword({ email, password })
          if (adminError) {
            submitLock.current = false
            setError(adminError.message)
            setLoading(false)
            return
          }
        }
        router.push("/admin/dashboard")
      } else {
        router.push("/account")
      }
    }
  }

  async function handleResend() {
    const supabase = createClient()
    if (!supabase || !email) return
    await supabase.auth.resend({ type: "signup", email })
    setResendSent(true)
  }

  return (
    <>
      <SuspendedAccountDialog open={suspendedOpen} onClose={() => setSuspendedOpen(false)} />
      <div className="flex min-h-[calc(100vh-160px)] flex-col md:grid md:grid-cols-2">
        <BrandPanel />
        <div className="flex min-w-0 flex-1 flex-col px-5 md:px-8 lg:px-14">
          <div className="mx-auto my-auto w-full max-w-md py-12">
            <p className="mb-8 text-balance text-center text-[11px] font-light uppercase leading-relaxed tracking-[0.16em] text-muted-foreground md:hidden">
              HAYDA SKINCo. · Authentic products · Free standard delivery · Rewards
            </p>

            <div className="mb-8 text-center">
              <p className="text-[11px] font-light uppercase tracking-[0.28em] text-gold mb-3">Account</p>
              <h1 className="font-serif text-4xl font-medium">Welcome back</h1>
              <p className="mt-3 text-sm font-light text-muted-foreground">
                Sign in to view your orders, wishlists, and saved favourites.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-email" className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full border border-border bg-background py-3 pl-11 pr-4 text-sm font-light outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-[11px] font-light text-gold underline-offset-2 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full border border-border bg-background py-3 pl-11 pr-11 text-sm font-light outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
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

            <div className="my-6 flex w-full items-center gap-4">
              <span className="flex-1 h-px bg-border" />
              <span className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">or</span>
              <span className="flex-1 h-px bg-border" />
            </div>

            <Link
              href="/checkout"
              className="block w-full border border-border py-4 text-center text-xs font-light uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
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
        </div>
      </div>
    </>
  )
}
