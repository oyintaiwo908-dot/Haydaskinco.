import { test, expect, waitForHydration } from "./fixtures"

// Runs in the "touch" project: iPhone 13 viewport, hasTouch + isMobile, Chromium. Every
// interaction is a real tap(), which waits for the page to acknowledge the touch event: a busy
// main thread or a swallowed pointerdown fails here even when click() would pass.
test.describe("touch: header controls", () => {
  for (const path of ["/", "/shop"]) {
    test(`${path}: menu, search and cart open on tap`, async ({ page }) => {
      await page.goto(path)
      const header = page.getByRole("banner")
      await waitForHydration(header.getByRole("button", { name: "Open menu" }))

      await header.getByRole("button", { name: "Open menu" }).tap()
      const menu = page.getByRole("dialog", { name: "Menu" })
      await expect(menu).toBeVisible()
      await expect(menu.getByRole("navigation", { name: "Mobile" })).toBeVisible()
      await menu.getByRole("button", { name: "Close" }).tap()
      await expect(menu).toBeHidden()

      await header.getByRole("button", { name: "Search", exact: true }).tap()
      const search = page.getByRole("dialog", { name: "Search products" })
      await expect(search).toBeVisible()
      await search.getByRole("button", { name: "Close" }).tap()
      await expect(search).toBeHidden()

      await header.getByRole("button", { name: /^Cart, \d+ items?$/ }).tap()
      const cart = page.getByRole("dialog", { name: /Your cart/ })
      await expect(cart).toBeVisible()
      await cart.getByRole("button", { name: "Close" }).tap()
      await expect(cart).toBeHidden()
    })
  }
})

test.describe("touch: layout", () => {
  for (const path of ["/", "/shop"]) {
    test(`${path}: nothing widens the page past the phone screen`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState("load")
      // A phone lays the page out wider (and zooms out) if anything overflows sideways. The home
      // ritual row once did, through absolutely positioned sr-only text in off-screen cards.
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      expect(innerWidth).toBe(390)
      expect(scrollWidth).toBeLessThanOrEqual(390)
    })
  }
})

test.describe("touch: product cards and hero", () => {
  test("quick-add on a card adds to the bag", async ({ page }) => {
    await page.goto("/shop")
    const add = page.getByRole("button", { name: /^Add .+ to cart$/ }).first()
    await waitForHydration(add)
    await add.tap()
    await expect(page.getByRole("button", { name: "Cart, 1 item" })).toBeVisible()
    await expect(page.locator("#site-announcer")).toHaveText(/Added .+ to cart/)
  })

  test("hero arrows and dots respond to taps (no pause button, by request)", async ({ page }) => {
    await page.goto("/")
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    await waitForHydration(hero.getByRole("button", { name: "Next slide" }))
    await expect(hero.getByRole("button", { name: /pause|play/i })).toHaveCount(0)
    await hero.getByRole("button", { name: "Next slide" }).tap()
    await expect(hero.getByRole("button", { name: /^Show slide 2/ })).toHaveAttribute("aria-current", "true")
    await hero.getByRole("button", { name: /^Show slide 3/ }).tap()
    await expect(hero.getByRole("button", { name: /^Show slide 3/ })).toHaveAttribute("aria-current", "true")
    await hero.getByRole("button", { name: "Previous slide" }).tap()
    await expect(hero.getByRole("button", { name: /^Show slide 2/ })).toHaveAttribute("aria-current", "true")
  })
})

test.describe("touch: hero autoplay", () => {
  test("advances by itself, and keeps going after a tap on a control", async ({ page }) => {
    test.slow() // two autoplay intervals
    await page.goto("/")
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    await waitForHydration(hero.getByRole("button", { name: "Next slide" }))
    await expect(hero.getByRole("button", { name: /^Show slide 2/ })).toHaveAttribute("aria-current", "true", { timeout: 10_000 })
    // A tap leaves focus on the button (no keyboard focus ring): autoplay must not stay held.
    await hero.getByRole("button", { name: "Next slide" }).tap()
    await expect(hero.getByRole("button", { name: /^Show slide 3/ })).toHaveAttribute("aria-current", "true")
    await expect(hero.getByRole("button", { name: /^Show slide 1/ })).toHaveAttribute("aria-current", "true", { timeout: 10_000 })
  })
})
