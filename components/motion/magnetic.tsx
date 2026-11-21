"use client"

import type { ReactNode } from "react"
import { useMotionValue, useSpring } from "motion/react"
import * as m from "motion/react-m"
import { MotionProvider } from "@/components/motion/motion-provider"
import { prefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion"

const SPRING = { stiffness: 220, damping: 16, mass: 0.4 }

/**
 * Magnetic wrapper for a primary call to action: on fine pointers the child leans toward the
 * cursor (up to `strength` px) and springs back on leave. Transform only; touch, keyboard and
 * reduced-motion users get the plain button.
 */
export function Magnetic({ children, strength = 10 }: { children: ReactNode; strength?: number }) {
  return (
    <MotionProvider>
      <MagneticInner strength={strength}>{children}</MagneticInner>
    </MotionProvider>
  )
}

function MagneticInner({ children, strength }: { children: ReactNode; strength: number }) {
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const x = useSpring(mx, SPRING)
  const y = useSpring(my, SPRING)
  return (
    <m.span
      className="inline-flex"
      style={{ x, y }}
      onPointerMove={e => {
        if (e.pointerType !== "mouse" || prefersReducedMotion()) return
        const r = e.currentTarget.getBoundingClientRect()
        mx.set(((e.clientX - r.left) / r.width - 0.5) * 2 * strength)
        my.set(((e.clientY - r.top) / r.height - 0.5) * 2 * strength)
      }}
      onPointerLeave={() => {
        mx.set(0)
        my.set(0)
      }}
    >
      {children}
    </m.span>
  )
}
