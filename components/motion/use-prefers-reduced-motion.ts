"use client"

import { useSyncExternalStore } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

/** Non-hook check for event handlers (e.g. before starting a WAAPI animation). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

/**
 * Live `prefers-reduced-motion` value. The server snapshot is `true` so the
 * first render never starts motion that the user may have asked to avoid;
 * the real value takes over after hydration.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => true)
}
