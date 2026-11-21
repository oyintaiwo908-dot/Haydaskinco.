"use client"

import { useEffect, useRef } from "react"
import { prefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion"
import { cn } from "@/lib/utils"

const FORMAT = new Intl.NumberFormat("en-NG")

/**
 * A number that counts up once when it scrolls into view. The server renders the final value
 * (correct without JS; screen readers get a stable visually hidden copy); the count
 * writes text on a ref per frame, so React does not re-render. Reduced motion: no count.
 */
export function CountUp({ value, duration = 1400, className }: { value: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return
    // Only count if it is still below the fold; never rewind a number someone is reading.
    if (el.getBoundingClientRect().top < window.innerHeight) return
    el.textContent = "0"
    let frame = 0
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration)
          const eased = 1 - Math.pow(1 - t, 4)
          el.textContent = FORMAT.format(Math.round(value * eased))
          if (t < 1) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(frame)
      el.textContent = FORMAT.format(value)
    }
  }, [value, duration])

  return (
    <span className={cn("lining-figures", className)}>
      <span ref={ref} aria-hidden>
        {FORMAT.format(value)}
      </span>
      <span className="sr-only">{FORMAT.format(value)}</span>
    </span>
  )
}
