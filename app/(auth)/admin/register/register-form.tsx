"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Lock, Mail, User, ArrowRight, Check, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { createAdminBrowserClient } from "@/lib/supabase/client"
import { extractFirstName } from "@/lib/auth"

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One number", test: (p: string) => /\d/.test(p) },
]

export default function AdminRegisterForm() {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const passwordStrength = PASSWORD_RULES.filter((r) => r.test(form.password)).length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (form.password !== form.confirm) {
      setError("Passwords do not match.")
      return
    }

    const allRulesPassed = PASSWORD_RULES.every(r => r.test(form.password))
    if (!allRulesPassed) {
      setError("Password does not meet all requirements.")
      return
    }

    setLoading(true)

    const supabase = createAdminBrowserClient()

    if (!supabase) {
      // No Supabase configured — mock path
      await new Promise(r => setTimeout(r, 900))
      router.push("/admin/dashboard")
      return
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.name,
          first_name: extractFirstName(form.name),
        },
      },
    })

    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    // Account created — show the "grant admin role" reminder before redirecting
    setDone(true)
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-green-50 border border-green-200">
            <ShieldCheck className="size-8 text-green-600" />
          </div>
          <h1 className="font-serif text-3xl font-medium mb-2">Account created</h1>
          <p className="text-sm font-light text-muted-foreground mb-8">
            Your account for <span className="text-foreground font-medium">{form.email}</span> has been registered.
            Before you can access the admin dashboard, a super-admin must grant your account the admin role.
          </p>

          <div className="mb-8 border border-border bg-secondary p-5 text-left">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-gold mb-3">
              One more step — grant admin access
            </p>
            <p className="text-xs font-light text-muted-foreground mb-3">
              Run this query in the Supabase SQL Editor:
            </p>
            <pre className="overflow-x-auto rounded-sm bg-foreground/5 border border-border p-3 text-[11px] font-mono leading-relaxed text-foreground">
{`UPDATE public.profiles
SET role = 'admin'
WHERE email = '${form.email}';`}
            </pre>
          </div>

          <Link
            href="/admin/login"
            className="inline-flex items-center gap-2 bg-foreground px-8 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-background hover:bg-gold hover:text-gold-foreground transition-colors"
          >
            Go to Sign In <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left: brand panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-foreground p-12 text-background">
        <Link href="/" className="font-serif text-2xl font-medium tracking-[0.25em]">
          HAYDA SKINCo.
        </Link>
        <div>
          <h2 className="font-serif text-3xl font-light leading-relaxed text-background/90">
            Join the HAYDA team
          </h2>
          <p className="mt-4 text-sm font-light text-background/50">
            Create an admin account to manage products, content, and analytics.
          </p>
        </div>
        <p className="text-xs font-light uppercase tracking-[0.2em] text-background/40">
          Admin Portal
        </p>
      </div>

      {/* Right: form */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-12 md:px-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-10 block font-serif text-2xl font-medium tracking-[0.25em] lg:hidden">
            HAYDA SKINCo.
          </Link>

          <div className="mb-8">
            <p className="text-[11px] font-light uppercase tracking-[0.25em] text-gold mb-2">Admin Portal</p>
            <h1 className="font-serif text-3xl font-medium">Create account</h1>
            <p className="mt-2 text-sm font-light text-muted-foreground">
              Set up your admin access to manage HAYDA SKINCo.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Your name"
                  required
                  className="w-full border border-border bg-background py-3 pl-11 pr-4 text-sm font-light outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/40"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="you@haydaskinco.com"
                  required
                  className="w-full border border-border bg-background py-3 pl-11 pr-4 text-sm font-light outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/40"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder="••••••••"
                  required
                  className="w-full border border-border bg-background py-3 pl-11 pr-11 text-sm font-light outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {/* Strength bar */}
              {form.password && (
                <div className="mt-1 space-y-1.5">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-all",
                          i < passwordStrength
                            ? passwordStrength === 1 ? "bg-destructive" : passwordStrength === 2 ? "bg-gold" : "bg-green-500"
                            : "bg-border",
                        )}
                      />
                    ))}
                  </div>
                  <div className="space-y-1">
                    {PASSWORD_RULES.map((rule) => (
                      <div key={rule.label} className="flex items-center gap-1.5">
                        <div className={cn("size-3 rounded-full flex items-center justify-center", rule.test(form.password) ? "bg-green-500" : "bg-border")}>
                          {rule.test(form.password) && <Check className="size-2 text-white" />}
                        </div>
                        <span className={cn("text-[10px]", rule.test(form.password) ? "text-foreground" : "text-muted-foreground")}>
                          {rule.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="password"
                  value={form.confirm}
                  onChange={set("confirm")}
                  placeholder="••••••••"
                  required
                  className={cn(
                    "w-full border bg-background py-3 pl-11 pr-4 text-sm font-light outline-none transition-colors placeholder:text-muted-foreground/40",
                    form.confirm && form.confirm !== form.password
                      ? "border-destructive focus:border-destructive"
                      : "border-border focus:border-foreground",
                  )}
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 px-4 py-2.5 rounded-sm">
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
                <>
                  <span className="size-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                  Creating account…
                </>
              ) : (
                <>Create Account <ArrowRight className="size-3.5" /></>
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-center text-xs font-light text-muted-foreground">
              Already have an account?{" "}
              <Link href="/admin/login" className="text-foreground font-medium underline-offset-2 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
