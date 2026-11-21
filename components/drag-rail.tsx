"use client"

import { useRef, useState, type ReactNode } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { prefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion"
import { cn } from "@/lib/utils"

/**
 * Horizontal snap rail. Touch scrolls natively (with the platform's momentum); a mouse can
 * drag it, and a flick carries on with decaying momentum before it snaps. Arrow buttons and
 * the keyboard (Tab through the cards; the rail scrolls them into view) also work. Scrolling
 * is the browser's own, so it stays on the compositor.
 */
export function DragRail({
  children,
  label,
  className,
  itemClassName,
}: {
  children: ReactNode[]
  label: string
  className?: string
  itemClassName?: string
}) {
  const ref = useRef<HTMLUListElement>(null)
  const drag = useRef<{ x: number; left: number; t: number; v: number; moved: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)
  const frame = useRef(0)

  function scrollByPage(dir: 1 | -1) {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: prefersReducedMotion() ? "auto" : "smooth" })
  }

  return (
    <div className={cn("relative", className)}>
      <ul
        ref={ref}
        aria-label={label}
        className="rail no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-2 md:gap-6 lg:-mx-8 lg:px-8"
        data-dragging={dragging || undefined}
        onPointerDown={e => {
          if (e.pointerType !== "mouse" || e.button !== 0) return
          cancelAnimationFrame(frame.current)
          drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, t: performance.now(), v: 0, moved: false }
        }}
        onPointerMove={e => {
          const d = drag.current
          if (!d) return
          const dx = e.clientX - d.x
          if (!d.moved && Math.abs(dx) < 6) return
          if (!d.moved) {
            d.moved = true
            setDragging(true)
            e.currentTarget.setPointerCapture(e.pointerId)
          }
          const now = performance.now()
          const next = d.left - dx
          d.v = (e.currentTarget.scrollLeft - next) / Math.max(1, now - d.t)
          d.t = now
          e.currentTarget.scrollLeft = next
        }}
        onPointerUp={e => {
          const d = drag.current
          drag.current = null
          if (!d?.moved) return
          const el = e.currentTarget
          // Swallow the click that follows a drag so cards do not open.
          el.addEventListener("click", ev => ev.preventDefault(), { capture: true, once: true })
          let v = -d.v * 16
          if (prefersReducedMotion()) v = 0
          const step = () => {
            if (Math.abs(v) < 0.5) {
              setDragging(false)
              return
            }
            el.scrollLeft += v
            v *= 0.92
            frame.current = requestAnimationFrame(step)
          }
          step()
        }}
        onPointerCancel={() => {
          drag.current = null
          setDragging(false)
        }}
      >
        {children.map((child, i) => (
          <li key={i} className={cn("shrink-0", itemClassName)}>
            {child}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          aria-label={`Scroll ${label} back`}
          className="flex size-11 items-center justify-center rounded-full border border-navy/20 text-navy transition-colors hover:border-navy hover:bg-navy hover:text-on-dark"
        >
          <ArrowLeft aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => scrollByPage(1)}
          aria-label={`Scroll ${label} forward`}
          className="flex size-11 items-center justify-center rounded-full border border-navy/20 text-navy transition-colors hover:border-navy hover:bg-navy hover:text-on-dark"
        >
          <ArrowRight aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  )
}
