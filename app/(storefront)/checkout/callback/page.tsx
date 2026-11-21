"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Check, XCircle } from "lucide-react"
import { useCart } from "@/components/cart-provider"
import { buttonVariants } from "@/components/ui/button"

function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-5 text-center">
      <span aria-hidden className="size-8 animate-spin rounded-full border-2 border-navy/20 border-t-navy" />
      <p className="text-muted-foreground">{label}</p>
    </div>
  )
}

function CallbackInner() {
  const searchParams = useSearchParams()
  const { clearCart } = useCart()
  // Paystack appends `reference` and/or `trxref` on redirect
  const reference = searchParams.get("reference") ?? searchParams.get("trxref") ?? ""
  const mock = searchParams.get("mock") === "1"

  const [result, setResult] = useState<{ status: "ok" | "fail"; message: string } | null>(null)

  useEffect(() => {
    if (!reference) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/orders/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference, mock }),
        })
        const data = await res.json()
        if (cancelled) return
        if (res.ok && data.ok) {
          clearCart()
          setResult({ status: "ok", message: data.message ?? "Payment confirmed." })
        } else {
          setResult({ status: "fail", message: data.error ?? data.message ?? "Payment could not be verified." })
        }
      } catch {
        if (!cancelled) setResult({ status: "fail", message: "Network error while verifying payment." })
      }
    })()
    return () => { cancelled = true }
  }, [reference, mock, clearCart])

  const status = !reference ? "fail" : result?.status ?? "loading"
  const message = !reference ? "Missing payment reference." : result?.message ?? ""

  if (status === "loading") return <Spinner label="Confirming your payment…" />

  if (status === "fail") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-5 text-center">
        <span className="mb-2 flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <XCircle aria-hidden className="size-8" />
        </span>
        <h1 className="font-serif text-3xl text-navy-deep">There was a problem with your payment</h1>
        <p role="alert" className="max-w-md text-muted-foreground">{message}</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link href="/checkout" className={buttonVariants({ variant: "outline" })}>Back to checkout</Link>
          <Link href="/shop" className={buttonVariants()}>Continue shopping</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-5 text-center">
      <span className="mb-2 flex size-16 items-center justify-center rounded-full bg-secondary text-navy">
        <Check aria-hidden className="size-8" />
      </span>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-rose">Payment successful</p>
      <h1 className="font-serif text-4xl text-navy-deep">Thank you</h1>
      <p className="max-w-md text-muted-foreground">
        Your order <span className="font-mono font-medium text-foreground">{reference}</span> is confirmed. You can track it any time from your account.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Link href="/account/orders" className={buttonVariants({ variant: "outline" })}>View orders</Link>
        <Link href="/shop" className={buttonVariants()}>Continue shopping</Link>
      </div>
    </div>
  )
}

export default function CheckoutCallbackPage() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <CallbackInner />
    </Suspense>
  )
}
