import { test as base, expect, type Locator, type Page, type Request } from "@playwright/test"

/**
 * Shared test with an automatic browser-side network guard: every request made by any page
 * in the test's context must go to the local app (or be a data:/blob: URL). Fonts are
 * self-hosted by next/font, so nothing external is expected at all.
 */
/** 1×1 transparent PNG: product photos in the mock catalogue are ~1 MB each and no test needs their pixels. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
)

export const test = base.extend<{ externalRequests: string[]; quietPage: void }>({
  quietPage: [
    async ({ context }, use) => {
      // The newsletter prompt opens after 20s; mark it as already dismissed for this session.
      await context.addInitScript(() => {
        try {
          window.sessionStorage.setItem("hayda_newsletter_dismissed", "1")
        } catch {}
      })
      // Image frames have fixed aspect ratios, so stubbing photos does not change layout.
      await context.route(/\.(png|jpe?g|webp|avif)(\?.*)?$/, route =>
        route.request().resourceType() === "image"
          ? route.fulfill({ contentType: "image/png", body: TINY_PNG })
          : route.continue(),
      )
      await use()
    },
    { auto: true },
  ],
  externalRequests: [
    async ({ context, baseURL }, use) => {
      const local = new URL(baseURL!).origin
      const external: string[] = []
      const onRequest = (req: Request) => {
        const url = req.url()
        if (url.startsWith("data:") || url.startsWith("blob:")) return
        const origin = new URL(url).origin
        if (origin !== local) external.push(origin)
      }
      context.on("request", onRequest)
      await use(external)
      context.off("request", onRequest)
      expect(external, "requests to non-local origins").toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** Products in the mock catalogue (lib/products.ts) used across specs. */
export const PDP_PATH = "/product/cerave-hydrating-cleanser"
export const PDP_NAME = "Hydrating Facial Cleanser"

/** True when focus is inside the open modal dialog (or parked on <body>, never on page content behind it). */
export async function focusStaysInDialog(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement
    if (!active || active === document.body) return true
    return Boolean(active.closest("dialog[open]"))
  })
}

/** Records document and RSC (client navigation) requests made while `action` runs. */
export async function serverRequestsDuring(page: Page, action: () => Promise<void>) {
  const seen: string[] = []
  const onRequest = (req: Request) => {
    const url = req.url()
    const headers = req.headers()
    // Viewport prefetches of visible links are not caused by the action under test.
    if (headers["next-router-prefetch"]) return
    const isRsc = url.includes("_rsc=") || headers["rsc"] === "1"
    if (req.resourceType() === "document" || isRsc) seen.push(url)
  }
  // Let the initial prefetch burst finish first.
  await page.waitForLoadState("networkidle")
  page.on("request", onRequest)
  await action()
  page.off("request", onRequest)
  return seen
}

type Rgb = [number, number, number]

/**
 * WCAG contrast ratio of an element against what is painted behind it, from computed styles.
 * - "text": the element's text colour; "fill": its own background (non-text, e.g. a bar);
 *   "placeholder": its ::placeholder colour.
 * Background colours of the ancestors are composited (alpha and opacity) over `base`.
 * Background images and gradients are not read: pass the worst colour that can sit under a
 * translucent layer as `base` (default white, the page canvas) and, with `startAt`, the
 * ancestor (CSS selector) where compositing begins, so opaque layers above it are ignored.
 */
export async function contrastOf(
  locator: Locator,
  kind: "text" | "fill" | "placeholder" = "text",
  base: Rgb = [255, 255, 255],
  startAt?: string,
) {
  return locator.evaluate(
    (el, { kind, base, startAt }) => {
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!
      // Canvas resolves any CSS colour syntax (oklch, color-mix results, hex) to sRGB bytes.
      const rgba = (css: string): [number, number, number, number] => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = "#000"
        ctx.fillStyle = css
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
        return a === 0 ? [0, 0, 0, 0] : [r, g, b, a / 255]
      }
      const over = (top: [number, number, number, number], under: number[], alpha: number) =>
        under.map((u, i) => top[i] * alpha + u * (1 - alpha))

      const chain: Element[] = []
      const stop = startAt ? el.closest(startAt) : null
      for (let node: Element | null = el; node; node = node.parentElement) {
        chain.unshift(node)
        if (node === stop) break
      }
      let bg: number[] = [...base]
      let opacity = 1
      for (const node of chain) {
        const style = getComputedStyle(node)
        opacity *= Number(style.opacity)
        if (node === el && kind === "fill") break
        const layer = rgba(style.backgroundColor)
        if (layer[3] > 0) bg = over(layer, bg, layer[3] * opacity)
      }
      const fgCss =
        kind === "text"
          ? getComputedStyle(el).color
          : kind === "fill"
            ? getComputedStyle(el).backgroundColor
            : getComputedStyle(el, "::placeholder").color
      const fgLayer = rgba(fgCss)
      const fg = over(fgLayer, bg, fgLayer[3] * opacity)
      const lum = (c: number[]) => {
        const [r, g, b] = c.map(v => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a)
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
    },
    { kind, base, startAt },
  )
}

/**
 * Waits until React has hydrated the element (its props are attached). A click on
 * server-rendered markup before that is lost, which under CPU load made tests flaky.
 */
export async function waitForHydration(locator: Locator) {
  await expect
    .poll(() => locator.evaluate(el => Object.keys(el).some(k => k.startsWith("__reactProps"))), { timeout: 20_000 })
    .toBe(true)
}

/** Adds the PDP product to the guest cart through the real UI. */
export async function addPdpItemToCart(page: Page) {
  await page.goto(PDP_PATH)
  const add = page.getByRole("main").getByRole("button", { name: "Add to cart", exact: true }).first()
  await waitForHydration(add)
  await add.click()
  await expect(page.getByRole("button", { name: "Cart, 1 item" })).toBeVisible()
}

/**
 * Turns the guest cart into one with stock problems: the real line asks for far more than the
 * mock stock, and a copy points at a product id that does not exist (unavailable).
 */
export async function seedStockIssues(page: Page) {
  await addPdpItemToCart(page)
  await page.evaluate(() => {
    const key = "hayda-cart-guest-v1"
    const items = JSON.parse(localStorage.getItem(key) || "[]") as Record<string, unknown>[]
    if (!items.length) throw new Error("guest cart is empty")
    const [first] = items
    const missing = { ...first, id: "e2e-missing-product", name: "Discontinued test item" }
    localStorage.setItem(key, JSON.stringify([{ ...first, quantity: 999 }, missing]))
  })
}
