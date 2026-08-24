"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronRight, Check, Lock, Truck, ArrowLeft, ShieldCheck, Zap, Building2, Smartphone, ShoppingBag, Gift } from "lucide-react"
import { useCart } from "@/components/cart-provider"
import { useUserAuth } from "@/components/user-auth-provider"
import { formatPrice, getUnitPriceForQuantity } from "@/lib/products"
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

const STEPS: { id: Step; label: string }[] = [
  { id: "shipping", label: "Shipping" },
  { id: "payment", label: "Payment" },
  { id: "review", label: "Review" },
]

function StepIndicator({ current }: { current: Step }) {
  const ids: Step[] = ["shipping", "payment", "review"]
  const currentIdx = ids.indexOf(current)
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-[11px] font-medium transition-all",
                  done
                    ? "border-gold bg-gold text-gold-foreground"
                    : active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[11px] uppercase tracking-[0.15em]",
                  active ? "font-medium text-foreground" : done ? "text-gold" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="mx-3 size-3.5 text-border" />
            )}
          </div>
        )
      })}
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

/** Express shipping in NGN — keep in sync with `/api/orders`. */
const EXPRESS_SHIPPING_NGN = 3000

const SHIPPING_METHODS = [
  { id: "standard" as const, label: "Standard Shipping", desc: "5–7 business days", price: 0, priceLabel: "Free" },
  {
    id: "express" as const,
    label: "Express Shipping",
    desc: "2–3 business days",
    price: EXPRESS_SHIPPING_NGN,
    priceLabel: formatPrice(EXPRESS_SHIPPING_NGN),
  },
]

export default function CheckoutPage() {
  const { items, subtotal, stockById, hasStockIssues, refreshAvailability, removeItem, updateQuantity } = useCart()
  const { session } = useUserAuth()
  const [step, setStep] = useState<Step>("shipping")
  const prefilledRef = useRef(false)
  const [savedAddressCount, setSavedAddressCount] = useState(0)
  const [stockReady, setStockReady] = useState(false)

  const [shipping, setShipping] = useState<ShippingData>({
    firstName: "", lastName: "", email: "", phone: "",
    address: "", apartment: "", city: "", state: "", zip: "", country: "Nigeria",
    shippingMethod: "standard",
  })

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card")

  // Promo codes / rewards (stackable)
  const [promoInput, setPromoInput] = useState("")
  const [appliedPromos, setAppliedPromos] = useState<AppliedPromo[]>([])
  const [promoError, setPromoError] = useState("")
  const [pointsBalance, setPointsBalance] = useState(0)
  const [redeemingReward, setRedeemingReward] = useState<string | null>(null)
  const [rewardMsg, setRewardMsg] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState("")
  const [orderRef, setOrderRef] = useState<string | null>(null)

  function addPromo(code: string, discountPct: number, discountNgn: number, label?: string | null) {
    const normalized = code.trim().toUpperCase()
    setAppliedPromos(prev => {
      if (prev.some(p => p.code === normalized)) return prev
      return [
        ...prev,
        {
          code: normalized,
          discountPct: Number(discountPct) || 0,
          discountNgn: Number(discountNgn) || 0,
          label: label ?? (normalized.startsWith("RWD-") ? "Rewards credit" : normalized),
        },
      ]
    })
    setPromoInput("")
    setPromoError("")
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

  // Auto-apply unused reward promo + load points balance
  useEffect(() => {
    if (!session) {
      setPointsBalance(0)
      return
    }
    let cancelled = false
    ;(async () => {
      const [pending, summary] = await Promise.all([
        getPendingRewardPromo(),
        getRewardsSummary(),
      ])
      if (cancelled) return
      setPointsBalance(summary?.balance ?? 0)
      if (pending && pending.discountNgn > 0) {
        addPromo(pending.code, 0, pending.discountNgn, pending.label)
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
      addPromo(
        data.code,
        Number(data.discount_pct || 0),
        Number(data.discount_ngn || 0),
        data.code?.startsWith("RWD-") ? "Rewards credit" : data.code,
      )
      setRewardMsg(null)
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
      addPromo(res.promoCode, 0, res.discountNgn ?? 0, "Rewards credit")
      setRewardMsg(`Redeemed! ₦${(res.discountNgn ?? 0).toLocaleString()} off added to this order.`)
      const summary = await getRewardsSummary()
      setPointsBalance(summary?.balance ?? 0)
    } else {
      setRewardMsg(res.message ?? "Could not redeem reward.")
    }
  }

  function removePromo(code: string) {
    setAppliedPromos(prev => prev.filter(p => p.code !== code))
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
  const shippingCost =
    SHIPPING_METHODS.find((m) => m.id === shipping.shippingMethod)?.price ?? 0
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
        <div className="flex size-16 items-center justify-center rounded-full bg-lavender mb-6">
          <Check className="size-8 text-gold" />
        </div>
        <p className="text-[11px] font-light uppercase tracking-[0.25em] text-gold mb-3">Order Confirmed</p>
        <h1 className="font-serif text-4xl font-medium text-foreground mb-4">Thank you for your order</h1>
        <p className="max-w-md text-sm font-light text-muted-foreground leading-relaxed mb-2">
          Your HAYDA SKINCo. order is on its way. A confirmation email has been sent to{" "}
          <span className="font-medium text-foreground">{shipping.email}</span>.
        </p>
        <p className="mb-8 text-[11px] font-light uppercase tracking-[0.18em] text-muted-foreground">
          Order #{orderRef ?? "—"}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/shop"
            className="border border-foreground px-8 py-3 text-xs font-medium uppercase tracking-[0.18em] transition-colors hover:bg-foreground hover:text-background"
          >
            Continue Shopping
          </Link>
          <Link
            href="/"
            className="bg-gold px-8 py-3 text-xs font-medium uppercase tracking-[0.18em] text-gold-foreground transition-opacity hover:opacity-80"
          >
            Return Home
          </Link>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-5 text-center">
        <p className="font-serif text-2xl font-medium">Your cart is empty</p>
        <p className="text-sm font-light text-muted-foreground">Add items to your cart before checking out.</p>
        <Link href="/shop" className="bg-foreground px-8 py-3 text-xs font-medium uppercase tracking-[0.18em] text-background">
          Shop Now
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
          <Link href="/" className="font-serif text-xl font-medium tracking-[0.15em]">
            HAYDA <span className="text-gold">SKINCo.</span>
          </Link>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="size-3" /> Secure checkout
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
        {/* Breadcrumb / Steps */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/shop"
            className="flex items-center gap-1.5 text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to shop
          </Link>
          <StepIndicator current={step} />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
          {/* Left: Form */}
          <div>
            {step === "shipping" && (
              <ShippingForm
                data={shipping}
                onChange={setShipping}
                onNext={() => {
                  if (hasStockIssues) return
                  setStep("payment")
                }}
                hasSavedAddress={savedAddressCount > 0}
                stockBlocked={hasStockIssues || !stockReady}
              />
            )}
            {step === "payment" && (
              <PaystackPaymentStep
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
                shipping={shipping}
                paymentMethod={paymentMethod}
                shippingCost={shippingCost}
                tax={tax}
                discount={discount}
                appliedPromos={appliedPromos}
                subtotal={subtotal}
                total={total}
                paying={paying}
                payError={payError}
                onBack={() => setStep("payment")}
                onConfirm={handleConfirm}
              />
            )}
          </div>

          {/* Right: Order summary */}
          <OrderSummary
            items={items}
            subtotal={subtotal}
            discount={discount}
            appliedPromos={appliedPromos}
            promoInput={promoInput}
            setPromoInput={setPromoInput}
            applyPromo={applyPromo}
            removePromo={removePromo}
            promoError={promoError}
            rewardMsg={rewardMsg}
            shippingCost={shippingCost}
            tax={tax}
            total={total}
            signedIn={Boolean(session)}
            pointsBalance={pointsBalance}
            redeemingReward={redeemingReward}
            onRedeemReward={handleRedeemReward}
            stockById={stockById}
            hasStockIssues={hasStockIssues}
            onRemoveItem={removeItem}
            onUpdateQuantity={updateQuantity}
          />
        </div>
      </div>
    </div>
  )
}

/* ─── Shipping Form ────────────────────────────────────────── */
function ShippingForm({
  data, onChange, onNext, hasSavedAddress, stockBlocked,
}: {
  data: ShippingData
  onChange: (d: ShippingData) => void
  onNext: () => void
  hasSavedAddress?: boolean
  stockBlocked?: boolean
}) {
  const set = (key: keyof ShippingData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...data, [key]: e.target.value })

  return (
    <div>
      <h2 className="font-serif text-2xl font-medium mb-2">Shipping Information</h2>
      {hasSavedAddress ? (
        <p className="mb-6 text-sm font-light text-muted-foreground">
          Prefilling from your default saved address. You can edit any field before continuing.
        </p>
      ) : (
        <div className="mb-6" />
      )}
      {stockBlocked && (
        <p className="mb-5 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-light text-destructive">
          One or more items in your cart are out of stock or exceed available quantity. Fix them in the order summary before continuing.
        </p>
      )}
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="First Name" value={data.firstName} onChange={set("firstName")} required />
          <FormField label="Last Name" value={data.lastName} onChange={set("lastName")} required />
        </div>
        <FormField label="Email Address" type="email" value={data.email} onChange={set("email")} required />
        <FormField label="Phone Number" type="tel" value={data.phone} onChange={set("phone")} />
        <FormField label="Address" value={data.address} onChange={set("address")} required />
        <FormField label="Apartment, suite, etc. (optional)" value={data.apartment} onChange={set("apartment")} />
        <div className="grid grid-cols-2 gap-4">
          <FormField label="City" value={data.city} onChange={set("city")} required />
          <FormField label="State / Province" value={data.state} onChange={set("state")} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="ZIP / Postal Code" value={data.zip} onChange={set("zip")} required />
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Country</label>
            <select
              value={data.country}
              onChange={set("country")}
              className="border border-border bg-background px-4 py-3 text-sm font-light outline-none focus:border-foreground transition-colors"
            >
              {["Nigeria", "United States", "United Kingdom", "Canada", "Australia", "France", "Germany"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Shipping method */}
        <div>
          <p className="mb-3 text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">
            Shipping Method
          </p>
          <div className="space-y-2">
            {SHIPPING_METHODS.map((method) => (
              <label
                key={method.id}
                className={cn(
                  "flex cursor-pointer items-center justify-between border p-4 transition-colors",
                  data.shippingMethod === method.id
                    ? "border-foreground bg-secondary"
                    : "border-border hover:border-foreground/50",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "size-4 rounded-full border-2 transition-all",
                      data.shippingMethod === method.id
                        ? "border-gold bg-gold"
                        : "border-border",
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium">{method.label}</p>
                    <p className="text-xs font-light text-muted-foreground">{method.desc}</p>
                  </div>
                </div>
                <p className="text-sm font-medium">{method.priceLabel}</p>
                <input
                  type="radio"
                  className="sr-only"
                  checked={data.shippingMethod === method.id}
                  onChange={() => onChange({ ...data, shippingMethod: method.id })}
                />
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={stockBlocked}
          className="mt-4 w-full bg-foreground py-4 text-xs font-medium uppercase tracking-[0.18em] text-background transition-colors hover:bg-gold hover:text-gold-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {stockBlocked ? "Resolve stock issues to continue" : "Continue to Payment"}
        </button>
      </div>
    </div>
  )
}

/* ─── Paystack Payment Step ────────────────────────────────── */
const PAYMENT_METHODS: { id: PaymentMethod; label: string; desc: string; icon: React.ElementType }[] = [
  { id: "card", label: "Debit / Credit Card", desc: "Visa, Mastercard, Verve", icon: Zap },
  { id: "bank_transfer", label: "Bank Transfer", desc: "Pay directly from your bank", icon: Building2 },
  { id: "ussd", label: "USSD", desc: "Pay via mobile USSD code", icon: Smartphone },
  { id: "mobile_money", label: "Mobile Money", desc: "MTN, Airtel, Glo Money", icon: Smartphone },
]

function PaystackPaymentStep({
  method, onMethodChange, total, email, onBack, onNext,
}: {
  method: PaymentMethod
  onMethodChange: (m: PaymentMethod) => void
  total: number
  email: string
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div>
      <h2 className="font-serif text-2xl font-medium mb-2">Payment</h2>
      <p className="mb-6 text-sm font-light text-muted-foreground flex items-center gap-1.5">
        <Lock className="size-3.5" /> Your payment is processed securely by Paystack.
      </p>

      {/* Paystack brand banner */}
      <div className="mb-6 border border-border bg-secondary p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Paystack wordmark (text-based since no asset) */}
            <div className="flex items-center gap-1.5">
              <div className="flex size-7 items-center justify-center rounded-full bg-[#00C3F7]">
                <span className="text-[11px] font-bold text-white">P</span>
              </div>
              <span className="text-sm font-semibold tracking-tight">Paystack</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-green-600" />
            <span className="text-[10px] font-light text-green-700 uppercase tracking-[0.12em]">Secured</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-light uppercase tracking-[0.18em] text-muted-foreground">Amount to pay</p>
            <p className="mt-0.5 font-serif text-2xl font-medium">{formatPrice(total)}</p>
          </div>
          {email && (
            <div className="text-right">
              <p className="text-[10px] font-light uppercase tracking-[0.18em] text-muted-foreground">Paying as</p>
              <p className="mt-0.5 text-sm font-medium">{email}</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment method selector */}
      <div className="mb-6">
        <p className="mb-3 text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">
          Select Payment Method
        </p>
        <div className="space-y-2">
          {PAYMENT_METHODS.map((m) => (
            <label
              key={m.id}
              onClick={() => onMethodChange(m.id)}
              className={cn(
                "flex cursor-pointer items-center gap-4 border p-4 transition-colors",
                method === m.id
                  ? "border-foreground bg-secondary"
                  : "border-border hover:border-foreground/40",
              )}
            >
              <div className={cn(
                "size-4 rounded-full border-2 transition-all shrink-0",
                method === m.id ? "border-gold bg-gold" : "border-border",
              )} />
              <div className="flex-1">
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs font-light text-muted-foreground">{m.desc}</p>
              </div>
              <m.icon className="size-4 text-muted-foreground shrink-0" />
            </label>
          ))}
        </div>
      </div>

      {/* Info note */}
      <div className="mb-6 flex items-start gap-3 border border-border/60 bg-secondary p-4 text-xs font-light text-muted-foreground">
        <Lock className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        <p>
          You will be redirected to a secure Paystack checkout page to complete your payment.
          Your financial details are never stored on our servers.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 border border-border px-6 py-4 text-xs font-medium uppercase tracking-[0.15em] transition-colors hover:border-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 bg-foreground py-4 text-xs font-medium uppercase tracking-[0.18em] text-background transition-colors hover:bg-gold hover:text-gold-foreground"
        >
          Review Order
        </button>
      </div>
    </div>
  )
}

/* ─── Review Step ──────────────────────────────────────────── */
const METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "Debit / Credit Card",
  bank_transfer: "Bank Transfer",
  ussd: "USSD",
  mobile_money: "Mobile Money",
}

function ReviewStep({
  shipping, paymentMethod, shippingCost, tax, discount, appliedPromos, subtotal, total, paying, payError, onBack, onConfirm,
}: {
  shipping: ShippingData
  paymentMethod: PaymentMethod
  shippingCost: number
  tax: number
  discount: number
  appliedPromos: AppliedPromo[]
  subtotal: number
  total: number
  paying: boolean
  payError: string
  onBack: () => void
  onConfirm: () => void
}) {
  return (
    <div>
      <h2 className="font-serif text-2xl font-medium mb-6">Review Order</h2>

      <div className="space-y-5">
        {/* Shipping summary */}
        <div className="border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Truck className="size-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-[0.15em]">Shipping</span>
            </div>
            <button
              type="button"
              onClick={() => onBack()}
              className="text-[11px] font-light uppercase tracking-[0.15em] text-gold underline-offset-2 hover:underline"
            >
              Edit
            </button>
          </div>
          <p className="text-sm font-light">
            {shipping.firstName} {shipping.lastName}
          </p>
          <p className="text-sm font-light text-muted-foreground">
            {shipping.address}{shipping.apartment && `, ${shipping.apartment}`}, {shipping.city}, {shipping.state} {shipping.zip}
          </p>
          <p className="text-sm font-light text-muted-foreground">{shipping.country}</p>
          <p className="mt-2 text-xs font-light text-muted-foreground">
            {shipping.shippingMethod === "express" ? "Express Shipping (2–3 days)" : "Standard Shipping (5–7 days)"}
          </p>
        </div>

        {/* Payment summary — Paystack */}
        <div className="border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-5 items-center justify-center rounded-full bg-[#00C3F7]">
                <span className="text-[9px] font-bold text-white">P</span>
              </div>
              <span className="text-xs font-medium uppercase tracking-[0.15em]">Payment via Paystack</span>
            </div>
          </div>
          <p className="text-sm font-light">{METHOD_LABELS[paymentMethod]}</p>
          <p className="mt-1 text-xs font-light text-muted-foreground">
            You will be redirected to Paystack to complete this payment securely.
          </p>
        </div>

        {/* Totals */}
        <div className="border border-border p-5 space-y-2.5">
          <LineItem label="Subtotal" value={formatPrice(subtotal)} />
          {discount > 0 && (
            <LineItem
              label={
                appliedPromos.length === 1
                  ? (appliedPromos[0].code.startsWith("RWD-") ? "Rewards discount" : `Promo (${appliedPromos[0].code})`)
                  : `Discounts (${appliedPromos.map(p => p.code).join(", ")})`
              }
              value={`-${formatPrice(discount)}`}
              className="text-green-700"
            />
          )}
          <LineItem label={shippingCost === 0 ? "Shipping (Free)" : "Express Shipping"} value={shippingCost === 0 ? "Free" : formatPrice(shippingCost)} />
          <LineItem label="Estimated Tax" value={formatPrice(tax)} />
          <div className="border-t border-border pt-2.5">
            <LineItem label="Total" value={formatPrice(total)} bold />
          </div>
        </div>

        {payError && (
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 px-4 py-2.5">
            {payError}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={paying}
            className="flex items-center gap-2 border border-border px-6 py-4 text-xs font-medium uppercase tracking-[0.15em] transition-colors hover:border-foreground disabled:opacity-40"
          >
            <ArrowLeft className="size-3.5" /> Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={paying}
            className="flex-1 flex items-center justify-center gap-2 bg-[#00C3F7] py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {paying ? (
              <>
                <span className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Redirecting…
              </>
            ) : (
              <><Lock className="size-3.5" /> Pay with Paystack</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Order Summary Sidebar ─────────────────────────────────── */
function OrderSummary({
  items, subtotal, discount, appliedPromos, promoInput, setPromoInput, applyPromo, removePromo,
  promoError, rewardMsg, shippingCost, tax, total,
  signedIn, pointsBalance, redeemingReward, onRedeemReward,
  stockById, hasStockIssues, onRemoveItem, onUpdateQuantity,
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
  rewardMsg: string | null
  shippingCost: number
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
}) {
  const redeemable = REWARD_CATALOG.filter(r => pointsBalance >= r.cost)

  return (
    <aside className="lg:sticky lg:top-24 h-fit">
      <div className="border border-border p-6">
        <h3 className="mb-5 text-xs font-medium uppercase tracking-[0.2em]">Order Summary</h3>
        {hasStockIssues && (
          <p className="mb-4 border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] font-light text-destructive">
            Some items are unavailable or limited. Remove out-of-stock items or reduce quantities to continue.
          </p>
        )}
        <ul className="divide-y divide-border mb-5">
          {items.map((item) => {
            const stock = stockById[item.id]
            const unavailable = Boolean(stock?.unavailable)
            return (
            <li key={item.id} className={cn("flex gap-3 py-3.5", unavailable && "opacity-70")}>
              <div className="relative size-16 shrink-0 overflow-hidden border border-border bg-muted">
                {item.image && item.image !== "/product-bundle.png" ? (
                  <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center bg-lavender">
                    <ShoppingBag className="size-7 text-gold/60" />
                  </div>
                )}

                <span className="absolute right-1.5 top-1 flex size-4 items-center justify-center rounded-full bg-foreground text-[9px] text-background">
                  {item.quantity}
                </span>
              </div>
              <div className="flex flex-1 flex-col justify-center min-w-0">
                <p className="text-[10px] font-light uppercase tracking-[0.18em] text-gold">
                  {item.id.startsWith("deal__") ? "Bundle Deal" : item.category}
                </p>
                <p className="text-xs font-medium leading-snug">{item.name}</p>
                {unavailable ? (
                  <p className="mt-1 text-[11px] font-medium text-destructive">Out of stock</p>
                ) : stock && stock.available <= 10 ? (
                  <p className="mt-1 text-[11px] font-light text-amber-600">Only {stock.available} left</p>
                ) : !item.id.startsWith("deal__") ? (
                  <p className="text-xs font-light text-muted-foreground">{item.tagline}</p>
                ) : null}
                {unavailable && (
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="mt-1 self-start text-[10px] font-medium uppercase tracking-[0.12em] text-destructive hover:underline"
                  >
                    Remove
                  </button>
                )}
                {!unavailable && !item.id.startsWith("deal__") && stock && item.quantity > stock.available && (
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.id, stock.available)}
                    className="mt-1 self-start text-[10px] font-medium uppercase tracking-[0.12em] text-amber-700 hover:underline"
                  >
                    Reduce to {stock.available}
                  </button>
                )}
              </div>
              <p className="text-xs font-medium self-center">
                {unavailable
                  ? "—"
                  : formatPrice(
                      getUnitPriceForQuantity(
                        {
                          price: item.listPrice ?? item.price,
                          listPrice: item.listPrice ?? item.price,
                          skuPrice: item.skuPrice ?? item.listPrice ?? item.price,
                          priceTiers: item.priceTiers,
                          discountPct: item.discountPct,
                        },
                        item.quantity,
                      ) * item.quantity,
                    )}
              </p>
            </li>
            )
          })}
        </ul>

        {/* Rewards */}
        {signedIn && (
          <div className="mb-4 border border-gold/30 bg-lavender/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.15em] text-gold">
                <Gift className="size-3.5" /> Rewards
              </p>
              <p className="text-[11px] font-light text-muted-foreground tabular-nums">
                {pointsBalance.toLocaleString()} pts
              </p>
            </div>
            {redeemable.length === 0 ? (
              <p className="text-[11px] font-light text-muted-foreground">
                Earn more points to redeem discounts here.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {redeemable.map(r => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-light leading-snug text-foreground">
                      {r.label}
                      <span className="ml-1 text-muted-foreground">({r.cost} pts)</span>
                    </span>
                    <button
                      type="button"
                      disabled={redeemingReward === r.id}
                      onClick={() => onRedeemReward(r.id)}
                      className="shrink-0 border border-gold/50 px-2 py-1 text-[10px] font-medium uppercase tracking-widest text-gold transition-colors hover:bg-gold hover:text-gold-foreground disabled:opacity-40"
                    >
                      {redeemingReward === r.id ? "…" : "Redeem"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Promo codes — stackable */}
        <div className="mb-4">
          <p className="mb-1.5 text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">
            Promo Codes
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter code…"
              value={promoInput}
              onChange={e => setPromoInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && applyPromo()}
              className="flex-1 border border-border bg-background px-3 py-2.5 text-xs font-light outline-none focus:border-foreground transition-colors uppercase placeholder:normal-case placeholder:text-muted-foreground/50"
            />
            <button
              type="button"
              onClick={applyPromo}
              className="shrink-0 border border-border px-3 py-2.5 text-[11px] font-medium uppercase tracking-widest hover:border-foreground transition-colors"
            >
              Apply
            </button>
          </div>
          {promoError && <p className="mt-1.5 text-[11px] font-light text-destructive">{promoError}</p>}
          {rewardMsg && <p className="mt-1.5 text-[11px] font-light text-green-700">{rewardMsg}</p>}
          {appliedPromos.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {appliedPromos.map(p => (
                <li key={p.code} className="flex items-center justify-between gap-2 border border-border/60 bg-secondary px-2.5 py-1.5">
                  <p className="text-[11px] font-light text-green-700">
                    ✓ {p.label} <span className="text-muted-foreground">({p.code})</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => removePromo(p.code)}
                    className="text-[10px] font-light uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <LineItem label="Subtotal" value={formatPrice(subtotal)} small />
          {appliedPromos.map(p => {
            const amount = p.discountNgn > 0
              ? p.discountNgn
              : Math.round(subtotal * (p.discountPct / 100))
            return (
              <LineItem
                key={p.code}
                label={p.code.startsWith("RWD-") ? "Rewards" : p.code}
                value={`-${formatPrice(amount)}`}
                small
                className="text-green-700"
              />
            )
          })}
          {discount > 0 && appliedPromos.length > 1 && (
            <LineItem label="Total discounts" value={`-${formatPrice(discount)}`} small className="text-green-700" />
          )}
          <LineItem label="Shipping" value={shippingCost === 0 ? "Free" : formatPrice(shippingCost)} small />
          <LineItem label="VAT (7.5%)" value={formatPrice(tax)} small />
          <div className="border-t border-border pt-2 mt-2">
            <LineItem label="Total" value={formatPrice(total)} bold />
          </div>
        </div>
      </div>

      {/* Trust badges */}
      <div className="mt-4 flex flex-col gap-2 text-center text-[10px] font-light uppercase tracking-[0.18em] text-muted-foreground">
        <span className="flex items-center justify-center gap-1.5">
          <Lock className="size-3" /> Secure & encrypted checkout
        </span>
        <span>Free returns within 30 days</span>
      </div>
    </aside>
  )
}

/* ─── Shared helpers ───────────────────────────────────────── */
function FormField({
  label, value, onChange, type = "text", required, placeholder, inputMode,
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  required?: boolean
  placeholder?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">
        {label}{required && <span className="text-gold ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        required={required}
        className="border border-border bg-background px-4 py-3 text-sm font-light outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/40"
      />
    </div>
  )
}

function LineItem({ label, value, bold, small, className }: { label: string; value: string; bold?: boolean; small?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className={cn("font-light text-muted-foreground", small ? "text-[11px]" : "text-xs uppercase tracking-[0.12em]")}>
        {label}
      </span>
      <span className={cn(bold ? "font-serif text-lg font-medium" : small ? "text-xs" : "text-sm", className)}>
        {value}
      </span>
    </div>
  )
}
