"use client"

import { useEffect, useRef } from "react"
import { prefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion"
import { cn } from "@/lib/utils"

const DIGITS = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 })
const FULL = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })

/**
 * A naira amount that rolls to its new value when it changes (totals, subtotals, prices).
 * Same look as <Money> (₦ in `.currency`). The roll writes text on a ref per frame, so React
 * does not re-render; screen readers get the settled value from a visually hidden copy.
 * Reduced motion: the value simply changes.
 */
export function MoneyTicker({ amount, className, duration = 520 }: { amount: number; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef(amount)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = shown.current
    const to = amount
    if (from === to || prefersReducedMotion()) {
      shown.current = to
      el.textContent = DIGITS.format(Math.abs(to))
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const value = Math.round(from + (to - from) * eased)
      shown.current = value
      el.textContent = DIGITS.format(Math.abs(value))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [amount, duration])

  return (
    <span className={cn("lining-figures whitespace-nowrap tabular-nums", className)}>
      <span aria-hidden>
        {amount < 0 ? "−" : ""}
        <span className="currency">₦</span>
        <span ref={ref}>{DIGITS.format(Math.abs(amount))}</span>
      </span>
      <span className="sr-only">{FULL.format(amount)}</span>
    </span>
  )
}
