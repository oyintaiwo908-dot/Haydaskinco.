"use client"

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react"

const STORAGE_KEY = "hayda-preview"
const CHANGE_EVENT = "hayda-preview-change"

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}
function readPreview() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}
function writePreview(on: boolean) {
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, "1")
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage blocked: preview lasts for this page only */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/**
 * Holding-page gate (only rendered when NEXT_PUBLIC_SITE_HOLDING=1).
 *
 * The server HTML is always the holding page. The real storefront tree is passed in as
 * `children` and shown only in preview mode: `?preview=<key>` is checked by /api/preview and
 * the browser remembers it (localStorage) until "Exit preview".
 *
 * Strength, honestly: this is a convenience gate, not security. The pages are static, so the
 * real page data still travels in the page's inline React Server Components payload (not as
 * visible HTML), and anyone who sets the localStorage flag by hand sees the real site. Ordering
 * is blocked server-side regardless (the order, promo and form APIs answer 503 while holding).
 */
export function HoldingGate({ holding, children }: { holding: ReactNode; children: ReactNode }) {
  const preview = useSyncExternalStore(subscribe, readPreview, () => false)
  const [status, setStatus] = useState<"idle" | "denied">("idle")

  // ?preview=<key>: verify once, remember, and take the key out of the address bar.
  useEffect(() => {
    const url = new URL(window.location.href)
    const key = url.searchParams.get("preview")
    if (!key) return
    url.searchParams.delete("preview")
    window.history.replaceState(null, "", url.pathname + url.search + url.hash)
    // No cancel on cleanup: the key has already left the URL, so a re-run (React StrictMode in
    // development) finds nothing to check and this single request must still report back.
    fetch("/api/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) })
      .then(res => (res.ok ? res.json() : { ok: false }))
      .then((data: { ok?: boolean }) => {
        if (data.ok) writePreview(true)
        else setStatus("denied")
      })
      .catch(() => setStatus("denied"))
  }, [])

  if (!preview) {
    return (
      <>
        {holding}
        {status === "denied" && (
          <p role="status" className="fixed inset-x-0 bottom-4 mx-auto w-fit bg-navy-deep px-4 py-2 text-xs text-on-dark">
            That preview link is not valid.
          </p>
        )}
      </>
    )
  }

  return (
    <>
      {children}
      <div className="fixed bottom-4 left-4 z-[70] flex items-center gap-3 bg-navy-deep px-3 py-2 text-xs text-on-dark shadow-float">
        <span className="font-medium uppercase tracking-[0.14em]">Preview mode</span>
        <button
          type="button"
          onClick={() => writePreview(false)}
          className="min-h-8 border border-on-dark/40 px-2.5 uppercase tracking-[0.14em] hover:bg-on-dark hover:text-navy-deep"
        >
          Exit
        </button>
      </div>
    </>
  )
}
