import { prefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion"

/**
 * Polite screen-reader announcement shared by every add-to-cart and favourite control.
 * Writes into the persistent #site-announcer region rendered by the storefront layout (a
 * region that exists before it changes is announced reliably, including Safari/VoiceOver).
 */
export function announce(message: string) {
  if (typeof document === "undefined") return
  let region = document.getElementById("site-announcer")
  if (!region) {
    // Outside the storefront layout: create one (first message may be missed there).
    region = document.createElement("div")
    region.id = "site-announcer"
    region.setAttribute("role", "status")
    region.setAttribute("aria-live", "polite")
    region.className = "sr-only"
    document.body.appendChild(region)
  }
  // Clear first so repeating the same message is announced again.
  region.textContent = ""
  const target = region
  window.setTimeout(() => {
    target.textContent = message
  }, 60)
}

function visibleCartIcon(): HTMLElement | null {
  const icons = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-icon]"))
  return icons.find(el => el.getClientRects().length > 0) ?? null
}

/**
 * Sends a ghost of the product image along a short arc to the cart icon, then bumps the
 * icon. Native Web Animations API, no library. Skipped under reduced motion or when the
 * icon is not on screen (e.g. checkout).
 */
export function flyToBag(source: HTMLElement | null) {
  if (typeof window === "undefined" || prefersReducedMotion()) return
  const target = visibleCartIcon()
  const img = source?.querySelector("img") ?? null
  if (!target || !img) return

  const from = img.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  if (!from.width || !to.width) return

  const size = Math.min(96, from.width)
  const ghost = img.cloneNode(true) as HTMLImageElement
  ghost.removeAttribute("srcset")
  ghost.removeAttribute("sizes")
  ghost.alt = ""
  ghost.setAttribute("aria-hidden", "true")
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${from.left + from.width / 2 - size / 2}px`,
    top: `${from.top + from.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: "cover",
    zIndex: "60",
    pointerEvents: "none",
    background: "#F7F3F1",
    boxShadow: "0 24px 60px -32px rgb(31 37 56 / 0.45)",
  })
  document.body.appendChild(ghost)

  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  const flight = ghost.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 80}px) scale(0.55)`, opacity: 0.95, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.2 },
    ],
    { duration: 620, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)", fill: "forwards" },
  )
  flight.onfinish = () => {
    ghost.remove()
    target.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], {
      duration: 320,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    })
  }
  flight.oncancel = () => ghost.remove()
}
