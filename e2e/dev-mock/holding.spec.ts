import { test, expect } from "@playwright/test"

/**
 * Holding page (NEXT_PUBLIC_SITE_HOLDING=1). These run against the mock `next dev` server that
 * playwright.config.ts starts with the flag on (the production mock build has it off).
 * Covered: the page on several routes, noindex, robots.txt, sitemap, 503 from the public write
 * APIs, the webhook/verify routes not blocked, the preview link (valid, invalid, exit), admin
 * unaffected. Not covered here: a production build with the flag on (same code path, but
 * built rather than compiled on demand), real Paystack webhooks, and crawlers' behaviour.
 */
const PREVIEW_KEY = "e2e-preview-key-0001"
const HOLDING_HEADING = /We.re currently working on the website/

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("hayda_newsletter_dismissed", "1")
    } catch {}
  })
})

test.describe("holding page", () => {
  for (const path of ["/", "/shop", "/product/cerave-hydrating-cleanser", "/checkout"]) {
    test(`${path} shows the holding page, noindex, no storefront chrome`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole("heading", { level: 1, name: HOLDING_HEADING })).toBeVisible()
      await expect(page.getByRole("link", { name: /hello@haydaskinco\.com/ })).toHaveAttribute("href", "mailto:hello@haydaskinco.com")
      await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /wa\.me|whatsapp/)
      await expect(page.getByRole("link", { name: /Instagram/ })).toHaveAttribute("href", /instagram\.com/)
      await expect(page.getByRole("button", { name: /^Cart/ })).toHaveCount(0)
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
      // The visible document is the holding page only.
      expect(await page.locator("body").innerText()).not.toMatch(/Add to cart|Featured campaigns|Shop all/i)
    })
  }

  test("robots.txt disallows everything and the sitemap lists only the home page", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text()
    expect(robots).toMatch(/Disallow: \/\s*$/m)
    const sitemap = await (await request.get("/sitemap.xml")).text()
    expect((sitemap.match(/<loc>/g) ?? []).length).toBe(1)
    expect(sitemap).not.toContain("/product/")
  })

  test("public write APIs refuse with 503; webhook and verify are not blocked", async ({ request }) => {
    for (const path of ["/api/orders", "/api/promo", "/api/newsletter", "/api/contact", "/api/wholesale"]) {
      const res = await request.post(path, { data: {} })
      expect(res.status(), path).toBe(503)
      expect((await res.json()).error, path).toMatch(/currently working on the website/)
    }
    for (const path of ["/api/orders/verify", "/api/webhooks/paystack"]) {
      const res = await request.post(path, { data: {} })
      expect(res.status(), path).not.toBe(503)
    }
  })

  test("preview link: a wrong key is refused, the right key shows the real site until Exit", async ({ page }) => {
    await page.goto("/?preview=not-the-key")
    await expect(page.getByRole("status")).toHaveText("That preview link is not valid.")
    await expect(page.getByRole("heading", { level: 1, name: HOLDING_HEADING })).toBeVisible()
    expect(page.url()).not.toContain("preview=")

    await page.goto(`/?preview=${PREVIEW_KEY}`)
    await expect(page.getByRole("region", { name: "Featured campaigns" })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText("Preview mode")).toBeVisible()
    expect(page.url()).not.toContain("preview=")

    // Remembered across pages.
    await page.goto("/shop")
    await expect(page.getByRole("button", { name: /^Cart/ })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText("Preview mode")).toBeVisible()

    await page.getByRole("button", { name: "Exit" }).click()
    await expect(page.getByRole("heading", { level: 1, name: HOLDING_HEADING })).toBeVisible()
  })

  test("the admin is not affected", async ({ page }) => {
    await page.goto("/admin/login")
    await expect(page.getByRole("heading", { level: 1, name: HOLDING_HEADING })).toHaveCount(0)
    await expect(page.getByLabel("Email Address")).toBeVisible()
  })
})
