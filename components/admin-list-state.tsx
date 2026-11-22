"use client"

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

/**
 * Admin lists keep their state (page, search text, filters, sort) in the URL query string and
 * remember their scroll position, so opening an item and coming back (Back, Save or Cancel)
 * reopens the list exactly where it was.
 *
 * - `useAdminListParams(defaults)`: URL-backed values; `set()` rewrites the query with
 *   history.replaceState (no navigation, no server round trip). Default values are left out.
 * - `useAdminScrollRestore(ready)`: saves the admin scroll container's position per list URL
 *   and restores it once the list has loaded.
 * - `adminReturnUrl(section)` / `<AdminBackLink section>`: the last URL of that list, for edit
 *   pages' Save, Cancel and Back.
 */

const RETURN_KEY = (section: string) => `admin-list:${section}`
const SCROLL_KEY = (url: string) => `admin-scroll:${url}`

function storage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** The list URL to go back to (falls back to the bare list path). */
export function adminReturnUrl(section: string): string {
  if (typeof window === "undefined") return section
  const saved = storage()?.getItem(RETURN_KEY(section))
  return saved && saved.startsWith(section) ? saved : section
}

export function useAdminListParams<T extends Record<string, string>>(defaults: T) {
  const params = useSearchParams()
  const pathname = usePathname()
  // Callers pass an object literal; a stable key keeps the memo and callback steady.
  const defaultsKey = JSON.stringify(defaults)
  const stableDefaults = useMemo(() => JSON.parse(defaultsKey) as Record<string, string>, [defaultsKey])

  const values = useMemo(() => {
    const out = {} as Record<string, string>
    for (const key of Object.keys(stableDefaults)) out[key] = params.get(key) ?? stableDefaults[key]
    return out as T
  }, [params, stableDefaults])

  const set = useCallback(
    (patch: Partial<T>) => {
      const next = new URLSearchParams(window.location.search)
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null || value === stableDefaults[key]) next.delete(key)
        else next.set(key, String(value))
      }
      const qs = next.toString()
      // Next's router picks up history.replaceState, so useSearchParams updates without a fetch.
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, stableDefaults],
  )

  // Remember this list URL for the edit pages.
  useEffect(() => {
    const qs = params.toString()
    storage()?.setItem(RETURN_KEY(pathname), qs ? `${pathname}?${qs}` : pathname)
  }, [pathname, params])

  return [values, set] as const
}

/** The admin layout scrolls `.admin-main`, not the window. */
function scroller(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".admin-main")
}

export function useAdminScrollRestore(ready: boolean) {
  const pathname = usePathname()
  const params = useSearchParams()
  const url = `${pathname}?${params.toString()}`
  const restored = useRef<string | null>(null)
  // The position saved for this URL, read during render, before this mount's own scroll events
  // can overwrite it (navigation and the loading state both move the scroll container).
  const savedTop = useMemo(
    () => (typeof window === "undefined" ? 0 : Number(storage()?.getItem(SCROLL_KEY(url)) ?? 0)),
    [url],
  )

  // Save while the visitor scrolls. A click (opening an item, Save, Back) saves the position at
  // that moment and freezes saving briefly: the navigation that follows resets the scroll
  // container before this listener is removed, and that reset must not overwrite the position.
  useEffect(() => {
    const el = scroller()
    if (!el) return
    let frame = 0
    let frozenUntil = 0
    const save = () => storage()?.setItem(SCROLL_KEY(url), String(Math.round(el.scrollTop)))
    const onScroll = () => {
      if (restored.current !== url || performance.now() < frozenUntil) return
      // Already on another page (the router has committed the next URL): not this list's scroll.
      if (window.location.pathname !== pathname) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(save)
    }
    const onClick = () => {
      if (restored.current !== url) return
      cancelAnimationFrame(frame)
      save()
      frozenUntil = performance.now() + 1500
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    document.addEventListener("click", onClick, true)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener("scroll", onScroll)
      document.removeEventListener("click", onClick, true)
    }
  }, [url, pathname])

  // Restore once per URL, after the rows are on the page.
  useEffect(() => {
    if (!ready || restored.current === url) return
    const top = savedTop
    const el = scroller()
    requestAnimationFrame(() => {
      if (el && top > 0) el.scrollTo({ top })
      restored.current = url
    })
  }, [ready, url, savedTop])
}

const noopSubscribe = () => () => {}

/** The remembered list URL as a value (server and first paint: the bare list path). */
export function useAdminReturnUrl(section: string): string {
  return useSyncExternalStore(noopSubscribe, () => adminReturnUrl(section), () => section)
}

/** "Back to list" link that returns to the remembered list URL. */
export function AdminBackLink({ section, className, children }: { section: string; className?: string; children: ReactNode }) {
  const href = useAdminReturnUrl(section)
  return (
    <Link href={href} scroll={false} className={className}>
      {children}
    </Link>
  )
}
