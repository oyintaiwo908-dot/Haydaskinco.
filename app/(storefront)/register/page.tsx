"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUserAuth } from "@/components/user-auth-provider"

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter",  test: (p: string) => /[A-Z]/.test(p) },
  { label: "One number",            test: (p: string) => /\d/.test(p) },
]

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

export default function RegisterPage() {
  const router = useRouter()
  const { signUp } = useUserAuth()
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [agreed, setAgreed] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const strength = PASSWORD_RULES.filter((r) => r.test(form.password)).length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (form.password !== form.confirm) { setError("Passwords do not match."); return }
    if (!agreed) { setError("Please accept the terms to continue."); return }
    setLoading(true)
    const err = await signUp(form.name, form.email, form.password)
    if (err) { setError(err); setLoading(false) }
    else router.push("/account")
  }

  return (
    <div className="flex min-h-[calc(100vh-160px)] flex-col md:grid md:grid-cols-2">
      <BrandPanel />
      <div className="flex min-w-0 flex-1 flex-col px-5 md:px-8 lg:px-14">
        <div className="mx-auto my-auto w-full max-w-md py-12">
          <p className="mb-8 text-balance text-center text-[11px] font-light uppercase leading-relaxed tracking-[0.16em] text-muted-foreground md:hidden">
            HAYDA SKINCo. · Authentic products · Free standard delivery · Rewards
          </p>

          <div className="mb-8 text-center">
            <p className="text-[11px] font-light uppercase tracking-[0.28em] text-gold mb-3">Account</p>
            <h1 className="font-serif text-4xl font-medium">Create account</h1>
            <p className="mt-3 text-sm font-light text-muted-foreground">
              Join HAYDA SKINCo. to track orders, leave reviews, and save your favourites.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-name" className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input id="register-name" autoComplete="name" type="text" value={form.name} onChange={set("name")} placeholder="Your name" required
                  className="w-full border border-border bg-background py-3 pl-11 pr-4 text-sm font-light outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-email" className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input id="register-email" autoComplete="email" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" required
                  className="w-full border border-border bg-background py-3 pl-11 pr-4 text-sm font-light outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-password" className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input id="register-password" autoComplete="new-password" type={showPassword ? "text" : "password"} value={form.password} onChange={set("password")} placeholder="••••••••" required
                  className="w-full border border-border bg-background py-3 pl-11 pr-11 text-sm font-light outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground" />
                <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-1 space-y-1.5">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className={cn("h-1 flex-1 rounded-full transition-all",
                        i < strength ? strength===1?"bg-destructive":strength===2?"bg-gold":"bg-green-500" : "bg-border")} />
                    ))}
                  </div>
                  <div className="space-y-1">
                    {PASSWORD_RULES.map(rule => (
                      <div key={rule.label} className="flex items-center gap-1.5">
                        <div className={cn("size-3 rounded-full flex items-center justify-center", rule.test(form.password)?"bg-green-500":"bg-border")}>
                          {rule.test(form.password) && <Check className="size-2 text-white" />}
                        </div>
                        <span className={cn("text-[10px]", rule.test(form.password)?"text-foreground":"text-muted-foreground")}>{rule.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-confirm" className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input id="register-confirm" autoComplete="new-password" type="password" value={form.confirm} onChange={set("confirm")} placeholder="••••••••" required
                  className={cn("w-full border bg-background py-3 pl-11 pr-4 text-sm font-light outline-none transition-colors placeholder:text-muted-foreground",
                    form.confirm && form.confirm !== form.password ? "border-destructive" : "border-border focus:border-foreground")} />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 pt-1">
              <div onClick={() => setAgreed(v => !v)}
                className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center border transition-all", agreed?"border-gold bg-gold":"border-border")}>
                {agreed && <Check className="size-2.5 text-gold-foreground" />}
              </div>
              <span className="text-xs font-light text-muted-foreground leading-relaxed">
                I agree to the{" "}
                <Link href="/terms" className="text-foreground underline-offset-2 hover:underline">Terms of Service</Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-foreground underline-offset-2 hover:underline">Privacy Policy</Link>.
              </span>
            </label>

            {error && (
              <p className="text-xs text-muted-foreground bg-muted border border-border px-4 py-3">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className={cn("flex w-full items-center justify-center gap-2 py-4 text-xs font-medium uppercase tracking-[0.18em] transition-all",
                loading ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-foreground text-background hover:bg-gold hover:text-gold-foreground")}>
              {loading
                ? <span className="size-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                : <>Create Account <ArrowRight className="size-3.5" /></>}
            </button>
          </form>

          <div className="my-6 flex w-full items-center gap-4">
            <span className="flex-1 h-px bg-border" />
            <span className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">or</span>
            <span className="flex-1 h-px bg-border" />
          </div>

          <Link href="/checkout"
            className="block w-full border border-border py-4 text-center text-xs font-light uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">
            Continue as Guest
          </Link>

          <p className="mt-8 text-center text-xs font-light text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-2 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
