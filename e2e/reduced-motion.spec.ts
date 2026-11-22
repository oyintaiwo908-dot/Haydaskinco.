import { test, expect, PDP_PATH } from "./fixtures"
import type { Page } from "@playwright/test"

// Runs in the "reduced-motion" project (prefers-reduced-motion: reduce).
async function movingAnimations(page: Page) {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter(a => a.playState === "running")
      .filter(a => {
        const effect = a.effect as KeyframeEffect | null
        if (!effect || typeof effect.getKeyframes !== "function") return false
        const props = effect.getKeyframes().flatMap(k => Object.keys(k))
        const timing = effect.getComputedTiming()
        const moves = props.some(p => p === "transform" || p === "translate" || p === "scale" || p === "rotate")
        // A 0.01ms reduced-motion transition is not visible motion.
        return moves && Number(timing.duration) > 50
      })
      .map(a => (a as CSSAnimation).animationName || (a as CSSTransition).transitionProperty || "script animation"),
  )
}

test.describe("reduced motion", () => {
  for (const path of ["/", "/shop", PDP_PATH, "/journal"]) {
    test(`${path}: nothing animates transform`, async ({ page }) => {
      await page.goto(path)
      await page.evaluate(() => document.fonts.ready)
      expect(await movingAnimations(page)).toEqual([])
    })
  }

  test("opening the cart sheet does not slide", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: /^Cart, \d+ items?$/ }).click()
    await expect(page.getByRole("dialog", { name: /Your cart/ })).toBeVisible()
    expect(await movingAnimations(page)).toEqual([])
  })

  test("hero autoplay never runs (and there is no pause button)", async ({ page }) => {
    await page.goto("/")
    await page.mouse.move(5, 5)
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    await expect(hero.getByRole("button", { name: "Next slide" })).toBeVisible()
    await expect(hero.getByRole("button", { name: /pause|play/i })).toHaveCount(0)
    await page.clock.install()
    await page.clock.fastForward(30_000)
    await page.clock.runFor(1_000)
    await expect(hero.getByRole("button", { name: /^Show slide 1/ })).toHaveAttribute("aria-current", "true")
    // Manual controls still work.
    await hero.getByRole("button", { name: "Next slide" }).click()
    await expect(hero.getByRole("button", { name: /^Show slide 2/ })).toHaveAttribute("aria-current", "true")
  })

  test("announcement bar stands still and shows only the first message", async ({ page }) => {
    await page.goto("/")
    const track = page.locator(".announce-track")
    expect(await track.evaluate(el => getComputedStyle(el).animationName)).toBe("none")
    const items = page.getByRole("list", { name: "Store announcements" }).getByRole("listitem")
    await expect(items.first()).toBeVisible()
    await expect(items.first()).toHaveText("Launching soon. We're still working on the site")
    await expect(items.nth(1)).toBeHidden()
    await expect(page.locator(".announce-list[aria-hidden]")).toBeHidden()
  })
})
