"use client"

import { useLayoutEffect, useRef, type RefObject } from "react"
import { prefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion"

/**
 * FLIP for a list or grid: after the children with `data-flip-key` change (items added,
 * removed or reordered), each one that moved glides from its old position to the new one.
 * With `enterNew`, items that were not there before rise in (never on the first render, so
 * server-rendered content does not animate again on hydration). Web Animations on transform
 * and opacity only; nothing re-renders.
 */
export function useFlip(listRef: RefObject<HTMLElement | null>, deps: unknown, { enterNew = false } = {}) {
  const positions = useRef(new Map<string, { x: number; y: number }>())

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const next = new Map<string, { x: number; y: number }>()
    const nodes = Array.from(list.querySelectorAll<HTMLElement>(":scope > [data-flip-key]"))
    for (const node of nodes) {
      const r = node.getBoundingClientRect()
      next.set(node.dataset.flipKey!, { x: r.left, y: r.top })
    }
    if (!prefersReducedMotion() && positions.current.size > 0) {
      let entering = 0
      for (const node of nodes) {
        const key = node.dataset.flipKey!
        const before = positions.current.get(key)
        const after = next.get(key)!
        if (!before) {
          if (enterNew) {
            node.animate([{ opacity: 0, transform: "translateY(20px) scale(0.98)" }, { opacity: 1, transform: "none" }], {
              duration: 520,
              delay: Math.min(entering++, 10) * 35,
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
              fill: "backwards",
            })
          }
        } else if (Math.abs(before.x - after.x) > 1 || Math.abs(before.y - after.y) > 1) {
          node.animate(
            [{ transform: `translate(${before.x - after.x}px, ${before.y - after.y}px)` }, { transform: "none" }],
            { duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
          )
        }
      }
    }
    positions.current = next
  }, [listRef, deps, enterNew])
}

/** Slides a row out before it is removed; resolves when done (immediately under reduced motion). */
export function animateOut(node: Element | null): Promise<void> {
  if (!node || prefersReducedMotion()) return Promise.resolve()
  const animation = node.animate(
    [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(24px)" }],
    { duration: 240, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)", fill: "forwards" },
  )
  return animation.finished.then(() => undefined, () => undefined)
}
