"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { Check, Lock, Truck, ArrowLeft, ShieldCheck, CreditCard, Building2, Smartphone, ShoppingBag, Gift, ChevronDown, X } from "lucide-react"
import { useCart } from "@/components/cart-provider"
import { useUserAuth } from "@/components/user-auth-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, Input, Select } from "@/components/ui/field"
import { Money } from "@/components/ui/price"
import { MoneyTicker } from "@/components/motion/money-ticker"
import { BrandLogo } from "@/components/brand-logo"
import { DELIVERY_LINE_LABEL, DELIVERY_NOTE } from "@/lib/storefront-copy"
import { getUnitPriceForQuantity } from "@/lib/products"
import { cn } from "@/lib/utils"
import { getAddresses, getProfile, addAddress, type Address } from "@/lib/supabase/profile"
import {
  getPendingRewardPromo,
  getRewardsSummary,
  redeemReward,
  REWARD_CATALOG,
} from "@/lib/supabase/rewards"
import type { StockAvailability } from "@/lib/supabase/cart-stock"

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: "", lastName: "" }
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

function addressToShipping(addr: Address, email: string) {
  const { firstName, lastName } = splitName(addr.full_name)
  return {
    firstName,
    lastName,
    email,
    phone: addr.phone ?? "",
    address: addr.line1,
    apartment: addr.line2 ?? "",
    city: addr.city,
    state: addr.state,
    zip: addr.postal_code ?? "",
    country: addr.country || "Nigeria",
  }
}

type Step = "shipping" | "payment" | "review" | "confirmed"

const STEPS: { id: Exclude<Step, "confirmed">; label: string }[] = [
  { id: "shipping", label: "Shipping" },
  { id: "payment", label: "Payment" },
  { id: "review", label: "Review" },
]

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex(s => s.id === current)
  const progress = STEPS.length > 1 ? currentIdx / (STEPS.length - 1) : 1
  return (
    <div className="relative">
      {/* Track and fill: the fill scales (transform only) as the steps advance. */}
      <span aria-hidden className="absolute left-4 right-4 top-4 h-px bg-navy/15" />
      <span
        aria-hidden
        className="step-fill absolute left-4 right-4 top-4 h-px origin-left bg-navy"
        style={{ transform: `scaleX(${progress})` }}
      />
      <ol className="relative grid grid-cols-3" aria-label="Checkout progress">
        {STEPS.map((step, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          return (
            <li
              key={step.id}
              aria-current={active ? "step" : undefined}
              className={cn("flex flex-col gap-2", i === 0 ? "items-start" : i === STEPS.length - 1 ? "items-end" : "items-center")}
            >
              <span
                aria-hidden
                className={cn(
                  "step-dot flex size-8 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                  active ? "scale-110 border-navy bg-navy text-on-dark" : done ? "border-navy bg-white text-navy" : "border-navy/20 bg-white text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-xs font-medium uppercase tracking-[0.14em]",
                  active ? "text-navy-deep" : done ? "text-navy" : "text-muted-foreground",
                )}
              >
                {step.label}
                {done && <span className="sr-only"> (completed)</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

type ShippingData = {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  apartment: string
  city: string
  state: string
  zip: string
  country: string
  shippingMethod: "standard" | "express"
}

type AppliedPromo = {
  code: string
  discountPct: number
  discountNgn: number
  label: string
}

type PaymentMethod = "card" | "bank_transfer" | "ussd" | "mobile_money"

/**
 * Delivery is not charged at checkout (owner decision): it is quoted and paid separately after
 * the order. `/api/orders` charges no delivery fee whatever the client sends.
 */
const shippingCost = 0

/** The delivery notice shown before payment and on the review step. */
function DeliveryNotice({ className }: { className?: string }) {
  return (
    <p role="note" className={cn("flex items-start gap-3 border border-navy/15 bg-secondary px-4 py-3 text-sm text-navy-deep", className)}>
      <Truck aria-hidden className="mt-0.5 size-4 shrink-0 text-navy" />
      <span>{DELIVERY_NOTE}</span>
    </p>
  )
}

/** Server rule (/api/orders): at most one regular promo code plus one `RWD-` rewards code per order. */
type PromoKind = "promo" | "reward"
function promoKind(code: string): PromoKind {
  return code.startsWith("RWD-") ? "reward" : "promo"
}

export default function CheckoutPage() {
  const { items, loading: cartLoading, subtotal, stockById, hasStockIssues, refreshAvailability, removeItem, updateQuantity } = useCart()
  const { session } = useUserAuth()
  const [step, setStep] = useState<Step>("shipping")
  const prefilledRef = useRef(false)
  const [savedAddressCount, setSavedAddressCount] = useState(0)
  const [stockReady, setStockReady] = useState(false)
  // Each step's h2 takes focus when the step changes (not on first load), so keyboard and
  // screen-reader users land on the new step instead of <body>.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const stepChanged = useRef(false)
  useEffect(() => {
    if (!stepChanged.current) {
      stepChanged.current = true
      return
    }
    stepHeadingRef.current?.focus()
  }, [step])

  const [shipping, setShipping] = useState<ShippingData>({
    firstName: "", lastName: "", email: "", phone: "",
    address: "", apartment: "", city: "", state: "", zip: "", country: "Nigeria",
    shippingMethod: "standard",
  })

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card")

  // Promo code + rewards code (one of each)
  const [promoInput, setPromoInput] = useState("")
  const [appliedPromos, setAppliedPromos] = useState<AppliedPromo[]>([])
  const appliedRef = useRef<AppliedPromo[]>([])
  const [promoError, setPromoError] = useState("")
  const [loadedPoints, setLoadedPoints] = useState(0)
  const [redeemingReward, setRedeemingReward] = useState<string | null>(null)
  const [rewardMsg, setRewardMsg] = useState<React.ReactNode>(null)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState("")
  const [orderRef, setOrderRef] = useState<string | null>(null)
  const pointsBalance = session ? loadedPoints : 0

  useEffect(() => {
    appliedRef.current = appliedPromos
  }, [appliedPromos])

  /** Adds a code, replacing any applied code of the same kind. Returns the replaced code, if any. */
  function addPromo(code: string, discountPct: number, discountNgn: number, label?: string | null, kind?: PromoKind) {
    const normalized = code.trim().toUpperCase()
    const k = kind ?? promoKind(normalized)
    const replaced = appliedRef.current.find(p => promoKind(p.code) === k && p.code !== normalized)?.code ?? null
    const next: AppliedPromo = {
      code: normalized,
      discountPct: Number(discountPct) || 0,
      discountNgn: Number(discountNgn) || 0,
      label: label ?? (k === "reward" ? "Rewards credit" : normalized),
    }
    const list = [...appliedRef.current.filter(p => promoKind(p.code) !== k), next]
    appliedRef.current = list
    setAppliedPromos(list)
    setPromoInput("")
    setPromoError("")
    return replaced
  }

  // Live stock check when landing on checkout
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await refreshAvailability()
      if (!cancelled) setStockReady(true)
    })()
    return () => { cancelled = true }
  }, [refreshAvailability, items.length])

  // Prefill from default saved address + profile when signed in
  useEffect(() => {
    if (!session || prefilledRef.current) return
    let cancelled = false

    ;(async () => {
      const [addrs, profile] = await Promise.all([getAddresses(), getProfile()])
      if (cancelled) return

      prefilledRef.current = true
      setSavedAddressCount(addrs.length)

      const email = profile?.email || session.email || ""
      const def = addrs.find(a => a.is_default) ?? addrs[0]

      if (def) {
        setShipping(prev => ({
          ...prev,
          ...addressToShipping(def, email || prev.email),
          shippingMethod: prev.shippingMethod,
        }))
        return
      }

      const { firstName, lastName } = splitName(profile?.full_name ?? session.name ?? "")
      setShipping(prev => ({
        ...prev,
        firstName: firstName || prev.firstName,
        lastName: lastName || prev.lastName,
        email: email || prev.email,
        phone: profile?.phone || prev.phone,
      }))
    })()

    return () => { cancelled = true }
  }, [session])

  // Auto-apply an unused reward promo (only if no rewards code is applied yet) + load points
  useEffect(() => {
    if (!session) return
    let cancelled = false
    ;(async () => {
      const [pending, summary] = await Promise.all([
        getPendingRewardPromo(),
        getRewardsSummary(),
      ])
      if (cancelled) return
      setLoadedPoints(summary?.balance ?? 0)
      const hasReward = appliedRef.current.some(p => promoKind(p.code) === "reward")
      if (pending && pending.discountNgn > 0 && !hasReward) {
        addPromo(pending.code, 0, pending.discountNgn, pending.label, "reward")
        setRewardMsg(`Rewards credit applied: ${pending.label}`)
      }
    })()
    return () => { cancelled = true }
  }, [session])

  async function applyPromo() {
    const code = promoInput.trim().toUpperCase()
    if (!code) return
    if (appliedPromos.some(p => p.code === code)) {
      setPromoError("This code is already applied.")
      return
    }
    setPromoError("")
    setRewardMsg(null)
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!data.valid) {
        setPromoError(data.message ?? "Invalid promo code.")
        return
      }
      const kind: PromoKind = data.kind === "reward" || data.kind === "promo" ? data.kind : promoKind(String(data.code))
      const replaced = addPromo(
        data.code,
        Number(data.discount_pct || 0),
        Number(data.discount_ngn || 0),
        kind === "reward" ? "Rewards credit" : data.code,
        kind,
      )
      setRewardMsg(
        replaced
          ? `${String(data.code).toUpperCase()} replaced ${replaced}. One ${kind === "reward" ? "rewards" : "promo"} code applies per order.`
          : null,
      )
    } catch {
      setPromoError("Could not validate promo code.")
    }
  }

  async function handleRedeemReward(rewardId: string) {
    if (!session) {
      setRewardMsg("Sign in to redeem rewards.")
      return
    }
    setRedeemingReward(rewardId)
    setRewardMsg(null)
    setPromoError("")
    const res = await redeemReward(rewardId)
    setRedeemingReward(null)
    if (res.ok && res.promoCode) {
      const replaced = addPromo(res.promoCode, 0, res.discountNgn ?? 0, "Rewards credit", "reward")
      setRewardMsg(
        <>
          Redeemed: <Money amount={res.discountNgn ?? 0} /> off added to this order.
          {replaced ? " It replaces your previous rewards code." : ""}
        </>,
      )
      const summary = await getRewardsSummary()
      setLoadedPoints(summary?.balance ?? 0)
    } else {
      setRewardMsg(res.message ?? "Could not redeem reward.")
    }
  }

  function removePromo(code: string) {
    const list = appliedRef.current.filter(p => p.code !== code)
    appliedRef.current = list
    setAppliedPromos(list)
    setRewardMsg(null)
  }

  const discount = Math.min(
    subtotal,
    appliedPromos.reduce((sum, p) => {
      if (p.discountNgn > 0) return sum + p.discountNgn
      if (p.discountPct > 0) return sum + Math.round(subtotal * (p.discountPct / 100))
      return sum
    }, 0),
  )
  const tax = Math.round(subtotal * 0.075)
  const total = Math.max(0, subtotal - discount + shippingCost + tax)

  async function handleConfirm() {
    setPaying(true)
    setPayError("")
    try {
      const blocked = await refreshAvailability()
      if (blocked) {
        setPayError("Some items are out of stock or limited. Update your cart and try again.")
        setPaying(false)
        setStep("shipping")
        return
      }
      // First checkout with no saved addresses → persist shipping as default
      if (session && savedAddressCount === 0 && shipping.address.trim() && shipping.city.trim()) {
        const err = await addAddress({
          label: "Home",
          full_name: `${shipping.firstName} ${shipping.lastName}`.trim(),
          line1: shipping.address.trim(),
          line2: shipping.apartment.trim() || null,
          city: shipping.city.trim(),
          state: shipping.state.trim() || "—",
          postal_code: shipping.zip.trim() || null,
          country: shipping.country || "Nigeria",
          phone: shipping.phone.trim() || null,
          is_default: true,
        })
        if (!err) setSavedAddressCount(1)
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(i => {
            const basePrice = i.listPrice ?? i.price
            const skuPrice = i.skuPrice ?? basePrice
            const unit = getUnitPriceForQuantity(
              {
                price: basePrice,
                listPrice: basePrice,
                skuPrice,
                priceTiers: i.priceTiers,
                discountPct: i.discountPct,
              },
              i.quantity,
            )
            return {
              productId: i.id,
              name: i.name,
              image: i.image,
              category: i.category,
              price: unit,
              quantity: i.quantity,
              skuPrice: i.skuPrice ?? i.listPrice ?? i.price,
            }
          }),
          shipping,
          paymentMethod,
          promoCodes: appliedPromos.map(p => p.code),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Server messages (stock, promo stacking, validation) are written for shoppers.
        setPayError(data.error ?? "Could not start checkout.")
        setPaying(false)
        return
      }
      setOrderRef(data.reference)
      // Redirect to Paystack (or mock callback when keys missing)
      if (data.authorization_url) {
        window.location.href = data.authorization_url
        return
      }
      setPayError("No payment URL returned.")
      setPaying(false)
    } catch {
      setPayError("Network error. Please try again.")
      setPaying(false)
    }
  }

  if (step === "confirmed") {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-5 text-center">
        <span className="mb-6 flex size-16 items-center justify-center rounded-full bg-secondary text-navy">
          <Check aria-hidden className="size-8" />
        </span>
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-rose">Order confirmed</p>
        <h1 className="mb-4 font-serif text-4xl text-navy-deep">Thank you for your order</h1>
        <p className="mb-2 max-w-md text-muted-foreground">
          A confirmation email has been sent to <span className="font-medium text-foreground">{shipping.email}</span>.
        </p>
        <p className="mb-8 text-xs uppercase tracking-[0.16em] text-muted-foreground">Order #{orderRef ?? "—"}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/shop" className={buttonVariants({ variant: "outline" })}>Continue shopping</Link>
          <Link href="/" className={buttonVariants()}>Return home</Link>
        </div>
      </div>
    )
  }

  const header = (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
        {/* Same wordmark as the storefront header. */}
        <Link href="/" aria-label="HAYDA SKINCo. home" className="inline-flex whitespace-nowrap">
          <BrandLogo className="h-8 sm:h-9" priority />
        </Link>
        <p className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
          <Lock aria-hidden className="size-3.5" /> Secure checkout<span className="hidden sm:inline">&nbsp;with Paystack</span>
        </p>
      </div>
      <noscript>
        <p className="border-t border-border bg-secondary px-5 py-3 text-center text-sm text-navy-deep">
          Checkout needs JavaScript to load your cart and pay securely with Paystack. Please enable it, or order on WhatsApp.
        </p>
      </noscript>
    </header>
  )

  if (cartLoading) {
    return (
      <>
        {header}
        <div role="status" className="mx-auto max-w-6xl px-5 py-10 md:px-8">
          <span className="sr-only">Loading your cart</span>
          <div aria-hidden className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className="space-y-5">
              <div className="h-8 w-48 animate-pulse bg-muted/50" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse bg-muted/50" />
              ))}
            </div>
            <div className="hidden h-72 animate-pulse bg-porcelain lg:block" />
          </div>
        </div>
      </>
    )
  }

  if (items.length === 0) {
    return (
      <>
        {header}
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-5 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-porcelain text-navy">
            <ShoppingBag aria-hidden className="size-7" strokeWidth={1.5} />
          </span>
          <h1 className="font-serif text-3xl text-navy-deep">Your cart is empty</h1>
          <p className="text-muted-foreground">Add items to your cart before checking out.</p>
          <Link href="/shop" className={buttonVariants()}>Shop now</Link>
        </div>
      </>
    )
  }

  const summaryProps = {
    items, subtotal, discount, appliedPromos, promoInput, setPromoInput, applyPromo, removePromo,
    promoError, rewardMsg, tax, total,
    signedIn: Boolean(session), pointsBalance, redeemingReward, onRedeemReward: handleRedeemReward,
    stockById, hasStockIssues, onRemoveItem: removeItem, onUpdateQuantity: updateQuantity,
  }

  return (
    <div className="min-h-screen bg-background">
      {header}

      <div className="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-10">
        <h1 className="sr-only">Checkout</h1>
        <div className="mb-6">
          <Link href="/shop" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-navy">
            <ArrowLeft aria-hidden className="size-4" /> Back to shop
          </Link>
        </div>

        {/* Phones: collapsible summary above the form */}
        <details className="disclosure group mb-6 border-y border-border lg:hidden">
          <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-medium text-navy">
              <ShoppingBag aria-hidden className="size-4" />
              <span className="group-open:hidden">Show order summary</span>
              <span className="hidden group-open:inline">Hide order summary</span>
              <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
            </span>
            <span className="font-medium tabular-nums"><Money amount={total} /></span>
          </summary>
          <div className="pb-5">
            <OrderSummary {...summaryProps} idPrefix="m" bare />
          </div>
        </details>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div>
            <div className="mb-8 max-w-md">
              <StepIndicator current={step} />
            </div>
            {step === "shipping" && (
              <ShippingForm
                headingRef={stepHeadingRef}
                data={shipping}
                onChange={setShipping}
                onNext={() => {
                  if (hasStockIssues) return
                  setStep("payment")
                }}
                hasSavedAddress={savedAddressCount > 0}
                stockBlocked={hasStockIssues}
                stockChecking={!stockReady}
                payError={payError}
              />
            )}
            {step === "payment" && (
              <PaystackPaymentStep
                headingRef={stepHeadingRef}
                method={paymentMethod}
                onMethodChange={setPaymentMethod}
                total={total}
                email={shipping.email}
                onBack={() => setStep("shipping")}
                onNext={() => setStep("review")}
              />
            )}
            {step === "review" && (
              <ReviewStep
                headingRef={stepHeadingRef}
                shipping={shipping}
                paymentMethod={paymentMethod}
                tax={tax}
                discount={discount}
                appliedPromos={appliedPromos}
                subtotal={subtotal}
                total={total}
                paying={paying}
                payError={payError}
                onBack={() => setStep("payment")}
                onEditShipping={() => setStep("shipping")}
                onConfirm={handleConfirm}
              />
            )}
          </div>

          <div className="hidden lg:block">
            <OrderSummary {...summaryProps} idPrefix="d" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Primary step action: pinned to the bottom of the screen on phones. */
function StepActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-8 flex gap-3 border-t border-border bg-background/90 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      {children}
    </div>
  )
}

/* ─── Shipping Form ────────────────────────────────────────── */
function ShippingForm({
  data, onChange, onNext, hasSavedAddress, stockBlocked, stockChecking, payError, headingRef,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  stockChecking?: boolean
  data: ShippingData
  onChange: (d: ShippingData) => void
  onNext: () => void
  hasSavedAddress?: boolean
  stockBlocked?: boolean
  payError?: string
}) {
  const set = (key: keyof ShippingData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...data, [key]: e.target.value })

  return (
    <form
      className="step-panel"
      onSubmit={e => {
        e.preventDefault()
        onNext()
      }}
    >
      <h2 ref={headingRef} tabIndex={-1} className="font-serif text-3xl text-navy-deep outline-none">Shipping</h2>
      {hasSavedAddress && (
        <p className="mt-2 text-sm text-muted-foreground">
          Prefilled from your default saved address. You can edit any field before continuing.
        </p>
      )}
      {payError && (
        <p role="alert" className="mt-5 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{payError}</p>
      )}
      {stockBlocked && (
        <p role="status" className="mt-5 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          One or more items in your cart are out of stock or exceed available quantity. Fix them in the order summary before continuing.
        </p>
      )}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="First name" required>
          <Input autoComplete="given-name" value={data.firstName} onChange={set("firstName")} />
        </Field>
        <Field label="Last name" required>
          <Input autoComplete="family-name" value={data.lastName} onChange={set("lastName")} />
        </Field>
        <Field label="Email" required hint="For your order confirmation." className="sm:col-span-2">
          <Input type="email" autoComplete="email" inputMode="email" value={data.email} onChange={set("email")} />
        </Field>
        <Field label="Phone" hint="The courier may call to arrange delivery." className="sm:col-span-2">
          <Input type="tel" autoComplete="tel" inputMode="tel" value={data.phone} onChange={set("phone")} />
        </Field>
        <Field label="Address" required className="sm:col-span-2">
          <Input autoComplete="address-line1" value={data.address} onChange={set("address")} />
        </Field>
        <Field label="Apartment, suite, etc. (optional)" className="sm:col-span-2">
          <Input autoComplete="address-line2" value={data.apartment} onChange={set("apartment")} />
        </Field>
        <Field label="City" required>
          <Input autoComplete="address-level2" value={data.city} onChange={set("city")} />
        </Field>
        <Field label="State" required>
          <Input autoComplete="address-level1" value={data.state} onChange={set("state")} />
        </Field>
        <Field label="Postal code (optional)">
          <Input autoComplete="postal-code" inputMode="numeric" value={data.zip} onChange={set("zip")} />
        </Field>
        <Field label="Country">
          <Select autoComplete="country-name" value={data.country} onChange={set("country")}>
            {["Nigeria", "United States", "United Kingdom", "Canada", "Australia", "France", "Germany"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>

      <section className="mt-8" aria-labelledby="delivery-note-title">
        <h3 id="delivery-note-title" className="mb-3 text-xs font-medium uppercase tracking-[0.14em]">Delivery</h3>
        <DeliveryNotice />
      </section>

      <StepActions>
        <Button type="submit" block size="lg" disabled={stockBlocked || stockChecking}>
          {stockChecking ? "Checking stock…" : stockBlocked ? "Fix stock issues to continue" : "Continue to payment"}
        </Button>
      </StepActions>
    </form>
  )
}

/* ─── Paystack Payment Step ────────────────────────────────── */
const PAYMENT_METHODS: { id: PaymentMethod; label: string; desc: string; icon: React.ElementType }[] = [
  { id: "card", label: "Debit or credit card", desc: "Visa, Mastercard, Verve", icon: CreditCard },
  { id: "bank_transfer", label: "Bank transfer", desc: "Pay directly from your bank", icon: Building2 },
  { id: "ussd", label: "USSD", desc: "Pay with a USSD code", icon: Smartphone },
  { id: "mobile_money", label: "Mobile money", desc: "MTN, Airtel, Glo", icon: Smartphone },
]

function PaystackPaymentStep({
  method, onMethodChange, total, email, onBack, onNext, headingRef,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  method: PaymentMethod
  onMethodChange: (m: PaymentMethod) => void
  total: number
  email: string
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="step-panel">
      <h2 ref={headingRef} tabIndex={-1} className="font-serif text-3xl text-navy-deep outline-none">Payment</h2>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Lock aria-hidden className="size-4" /> Payments are processed securely by Paystack.
      </p>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 bg-porcelain p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Amount to pay</p>
          <p className="mt-1 font-serif text-3xl text-navy-deep tabular-nums"><Money amount={total} /></p>
        </div>
        {email && (
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Paying as</p>
            <p className="mt-1 text-sm font-medium">{email}</p>
          </div>
        )}
      </div>

      <fieldset className="mt-6">
        <legend className="mb-3 text-xs font-medium uppercase tracking-[0.14em]">Pay with</legend>
        <div className="space-y-2">
          {PAYMENT_METHODS.map((m) => {
            const checked = method === m.id
            return (
              <label
                key={m.id}
                className={cn(
                  "flex min-h-16 cursor-pointer items-center gap-4 rounded-control border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                  checked ? "border-navy bg-secondary" : "border-input hover:border-navy",
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m.id}
                  checked={checked}
                  onChange={() => onMethodChange(m.id)}
                  className="size-4 accent-navy"
                  data-focus="custom"
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="block text-sm text-muted-foreground">{m.desc}</span>
                </span>
                <m.icon aria-hidden className="size-5 shrink-0 text-navy" strokeWidth={1.5} />
              </label>
            )
          })}
        </div>
      </fieldset>

      <p className="mt-6 flex items-start gap-3 text-sm text-muted-foreground">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-navy" />
        You will be redirected to Paystack&apos;s secure page to complete payment. Your card details are never stored on our servers.
      </p>

      <StepActions>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft aria-hidden /> Back
        </Button>
        <Button onClick={onNext} className="flex-1">Review order</Button>
      </StepActions>
    </div>
  )
}

/* ─── Review Step ──────────────────────────────────────────── */
const METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "Debit or credit card",
  bank_transfer: "Bank transfer",
  ussd: "USSD",
  mobile_money: "Mobile money",
}

function ReviewStep({
  shipping, paymentMethod, tax, discount, appliedPromos, subtotal, total, paying, payError, onBack, onEditShipping, onConfirm, headingRef,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  shipping: ShippingData
  paymentMethod: PaymentMethod
  tax: number
  discount: number
  appliedPromos: AppliedPromo[]
  subtotal: number
  total: number
  paying: boolean
  payError: string
  onBack: () => void
  onEditShipping: () => void
  onConfirm: () => void
}) {
  return (
    <div className="step-panel">
      <h2 ref={headingRef} tabIndex={-1} className="font-serif text-3xl text-navy-deep outline-none">Review your order</h2>

      <div className="mt-6 space-y-4">
        <section className="border border-border p-5" aria-labelledby="review-ship">
          <div className="mb-3 flex items-center justify-between">
            <h3 id="review-ship" className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em]">
              <Truck aria-hidden className="size-4 text-navy" /> Delivery address
            </h3>
            <button type="button" onClick={onEditShipping} className="min-h-11 px-2 text-sm text-navy underline underline-offset-4">
              Edit<span className="sr-only"> shipping details</span>
            </button>
          </div>
          <p>{shipping.firstName} {shipping.lastName}</p>
          <p className="text-muted-foreground">
            {shipping.address}{shipping.apartment && `, ${shipping.apartment}`}, {shipping.city}, {shipping.state} {shipping.zip}
          </p>
          <p className="text-muted-foreground">{shipping.country}</p>
          <DeliveryNotice className="mt-4" />
        </section>

        <section className="border border-border p-5" aria-labelledby="review-pay">
          <h3 id="review-pay" className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em]">
            <Lock aria-hidden className="size-4 text-navy" /> Payment via Paystack
          </h3>
          <p>{METHOD_LABELS[paymentMethod]}</p>
          <p className="mt-1 text-sm text-muted-foreground">You will be redirected to Paystack to complete this payment securely.</p>
        </section>

        <section className="space-y-2.5 border border-border p-5" aria-label="Order total">
          <LineItem label="Subtotal" value={<Money amount={subtotal} />} />
          {discount > 0 && (
            <LineItem
              label={
                appliedPromos.length === 1
                  ? (promoKind(appliedPromos[0].code) === "reward" ? "Rewards discount" : `Promo (${appliedPromos[0].code})`)
                  : `Discounts (${appliedPromos.map(p => p.code).join(", ")})`
              }
              value={<>−<Money amount={discount} /></>}
              className="text-success"
            />
          )}
          <LineItem label="Delivery" value={DELIVERY_LINE_LABEL} />
          <LineItem label="VAT (7.5%)" value={<Money amount={tax} />} />
          <div className="border-t border-border pt-2.5">
            <LineItem label="Total" value={<Money amount={total} />} bold />
          </div>
        </section>

        {payError && (
          <p role="alert" className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{payError}</p>
        )}
      </div>

      <StepActions>
        <Button variant="outline" onClick={onBack} disabled={paying}>
          <ArrowLeft aria-hidden /> Back
        </Button>
        <Button onClick={onConfirm} disabled={paying} className="flex-1" aria-busy={paying}>
          {paying ? (
            <>
              <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Redirecting to Paystack…
            </>
          ) : (
            <><Lock aria-hidden /> Pay <Money amount={total} /></>
          )}
        </Button>
      </StepActions>
    </div>
  )
}

/* ─── Order Summary ─────────────────────────────────────────── */
function OrderSummary({
  items, subtotal, discount, appliedPromos, promoInput, setPromoInput, applyPromo, removePromo,
  promoError, rewardMsg, tax, total,
  signedIn, pointsBalance, redeemingReward, onRedeemReward,
  stockById, hasStockIssues, onRemoveItem, onUpdateQuantity,
  idPrefix, bare = false,
}: {
  items: ReturnType<typeof useCart>["items"]
  subtotal: number
  discount: number
  appliedPromos: AppliedPromo[]
  promoInput: string
  setPromoInput: (v: string) => void
  applyPromo: () => void | Promise<void>
  removePromo: (code: string) => void
  promoError: string
  rewardMsg: React.ReactNode
  tax: number
  total: number
  signedIn: boolean
  pointsBalance: number
  redeemingReward: string | null
  onRedeemReward: (id: string) => void | Promise<void>
  stockById: Record<string, StockAvailability>
  hasStockIssues: boolean
  onRemoveItem: (id: string) => void
  onUpdateQuantity: (id: string, quantity: number) => void
  /** Keeps ids unique: the summary renders twice (phone disclosure and desktop column). */
  idPrefix: string
  bare?: boolean
}) {
  const redeemable = REWARD_CATALOG.filter(r => pointsBalance >= r.cost)
  const promoId = `${idPrefix}-promo`

  return (
    <aside aria-label="Order summary" className={cn(!bare && "lg:sticky lg:top-8")}>
      <div className={cn(!bare && "receipt relative bg-white px-6 pb-8 pt-7 shadow-float")}>
        {!bare && (
          <div className="mb-5 border-b border-dashed border-navy/25 pb-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">HAYDA SKINCo. · Order</p>
            <h2 className="mt-1 font-serif text-3xl text-navy-deep">Order summary</h2>
          </div>
        )}
        {hasStockIssues && (
          <p className="mb-4 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Some items are unavailable or limited. Remove them or reduce quantities to continue.
          </p>
        )}
        <ul className="mb-5 divide-y divide-border">
          {items.map((item) => {
            const stock = stockById[item.id]
            const unavailable = Boolean(stock?.unavailable)
            return (
              <li key={item.id} className="flex gap-3 py-3.5">
                <div className={cn("product-stage relative size-16 shrink-0", unavailable && "opacity-50")}>
                  {item.image && item.image !== "/product-bundle.png" ? (
                    <Image src={item.image} alt="" fill sizes="64px" className="object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-navy/60">
                      <ShoppingBag aria-hidden className="size-6" />
                    </span>
                  )}
                  <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-primary-foreground tabular-nums">
                    {item.quantity}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {item.id.startsWith("deal__") ? "Bundle deal" : item.category}
                  </p>
                  <p className="text-sm font-medium leading-snug">
                    {item.name} <span className="sr-only">, quantity {item.quantity}</span>
                  </p>
                  {unavailable ? (
                    <p className="mt-1 text-xs font-medium text-destructive">Out of stock</p>
                  ) : stock && stock.available <= 10 ? (
                    <p className="mt-1 text-xs text-warning">Only {stock.available} left</p>
                  ) : null}
                  {unavailable && (
                    <button type="button" onClick={() => onRemoveItem(item.id)} className="mt-1 min-h-9 self-start text-xs font-medium uppercase tracking-[0.12em] text-destructive underline-offset-4 hover:underline">
                      Remove<span className="sr-only"> {item.name}</span>
                    </button>
                  )}
                  {!unavailable && !item.id.startsWith("deal__") && stock && item.quantity > stock.available && (
                    <button type="button" onClick={() => onUpdateQuantity(item.id, stock.available)} className="mt-1 min-h-9 self-start text-xs font-medium uppercase tracking-[0.12em] text-warning underline-offset-4 hover:underline">
                      Reduce to {stock.available}
                    </button>
                  )}
                </div>
                <p className="self-center text-sm font-medium tabular-nums">
                  {unavailable
                    ? <span className="text-xs font-medium text-destructive">Unavailable</span>
                    : (
                      <Money
                        amount={
                          getUnitPriceForQuantity(
                            {
                              price: item.listPrice ?? item.price,
                              listPrice: item.listPrice ?? item.price,
                              skuPrice: item.skuPrice ?? item.listPrice ?? item.price,
                              priceTiers: item.priceTiers,
                              discountPct: item.discountPct,
                            },
                            item.quantity,
                          ) * item.quantity
                        }
                      />
                    )}
                </p>
              </li>
            )
          })}
        </ul>

        {signedIn && (
          <div className="mb-5 border border-navy/15 bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-navy">
                <Gift aria-hidden className="size-4" /> Rewards
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">{pointsBalance.toLocaleString()} pts</p>
            </div>
            {redeemable.length === 0 ? (
              <p className="text-sm text-muted-foreground">Earn more points to redeem discounts here.</p>
            ) : (
              <ul className="space-y-1">
                {redeemable.map(r => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm leading-snug">
                      {r.label} <span className="text-muted-foreground">({r.cost} pts)</span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={redeemingReward === r.id}
                      onClick={() => onRedeemReward(r.id)}
                      aria-label={`Redeem ${r.label} for ${r.cost} points`}
                    >
                      {redeemingReward === r.id ? "…" : "Redeem"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">One rewards code applies per order.</p>
          </div>
        )}

        {/* Promo code: one regular code plus one rewards code per order */}
        <div className="mb-5">
          <label htmlFor={promoId} className="mb-2 block text-xs font-medium uppercase tracking-[0.14em]">Promo code</label>
          <div className="flex gap-2">
            <Input
              id={promoId}
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="Enter code"
              value={promoInput}
              onChange={e => setPromoInput(e.target.value.toUpperCase())}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void applyPromo()
                }
              }}
              aria-describedby={`${promoId}-hint ${promoId}-msg`}
              aria-invalid={promoError ? true : undefined}
              className="uppercase placeholder:normal-case"
            />
            <Button variant="outline" onClick={() => void applyPromo()}>Apply</Button>
          </div>
          <p id={`${promoId}-hint`} className="mt-1.5 text-xs text-muted-foreground">One promo code and one rewards code per order.</p>
          <div id={`${promoId}-msg`} aria-live="polite">
            {promoError && <p className="mt-1.5 text-sm text-destructive">{promoError}</p>}
            {rewardMsg && <p className="mt-1.5 text-sm text-success">{rewardMsg}</p>}
          </div>
          {appliedPromos.length > 0 && (
            <ul className="mt-3 space-y-1.5" aria-label="Applied codes">
              {appliedPromos.map(p => (
                <li key={p.code} className="flex items-center justify-between gap-2 border border-border bg-white px-3 py-1">
                  <p className="flex items-center gap-1.5 text-sm text-success">
                    <Check aria-hidden className="size-4" /> {p.label} <span className="text-muted-foreground">({p.code})</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => removePromo(p.code)}
                    aria-label={`Remove code ${p.code}`}
                    className="flex size-9 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 border-t border-dashed border-navy/25 pt-4 font-mono">
          <LineItem label="Subtotal" value={<MoneyTicker amount={subtotal} />} small />
          {appliedPromos.map(p => {
            const amount = p.discountNgn > 0 ? p.discountNgn : Math.round(subtotal * (p.discountPct / 100))
            return (
              <LineItem
                key={p.code}
                label={promoKind(p.code) === "reward" ? "Rewards" : p.code}
                value={<>−<Money amount={amount} /></>}
                small
                className="text-success"
              />
            )
          })}
          {discount > 0 && appliedPromos.length > 1 && (
            <LineItem label="Total discounts" value={<>−<Money amount={discount} /></>} small className="text-success" />
          )}
          <LineItem label="Delivery" value={DELIVERY_LINE_LABEL} small />
          <LineItem label="VAT (7.5%)" value={<MoneyTicker amount={tax} />} small />
          <div className="mt-3 border-t-2 border-double border-navy/30 pt-3 font-sans">
            <LineItem label="Total" value={<MoneyTicker amount={total} />} bold />
          </div>
        </div>
      </div>

      {!bare && (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock aria-hidden className="size-3.5" /> Payments secured by Paystack ·{" "}
          <Link href="/returns" prefetch={false} className="underline underline-offset-4 hover:text-foreground">Returns</Link>
        </p>
      )}
    </aside>
  )
}

/* ─── Shared helpers ───────────────────────────────────────── */
function LineItem({ label, value, bold, small, className }: { label: string; value: React.ReactNode; bold?: boolean; small?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <span className={cn(small ? "text-sm" : "text-sm", bold ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</span>
      <span className={cn("tabular-nums", bold ? "font-serif text-2xl text-navy-deep" : "text-sm", className)}>{value}</span>
    </div>
  )
}
