"use client"

import type { ReactNode } from "react"
import { LazyMotion } from "motion/react"

const loadFeatures = () => import("./features").then(mod => mod.default)

/**
 * Motion island root. Components inside use `m.*` from "motion/react-m" (a few KB); the
 * animation features load after hydration. `strict` makes a stray full `motion.*` import fail
 * loudly instead of silently pulling the whole library into the page.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  )
}
