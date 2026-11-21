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

  test("hero autoplay is off", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("region", { name: "Featured campaigns" }).getByRole("button", { name: "Play slideshow" })).toBeVisible()
  })

  test("review must-fix 5: Play is an explicit opt-in that really starts the slideshow", async ({ page }) => {
    await page.goto("/")
    await page.mouse.move(5, 5)
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    const play = hero.getByRole("button", { name: "Play slideshow" })
    await expect(play).not.toHaveAttribute("aria-pressed")
    await play.focus()
    await page.keyboard.press("Enter")
    const pause = hero.getByRole("button", { name: "Pause slideshow" })
    await expect(pause).toBeFocused()
    // Focus inside the hero holds autoplay; move it out, then the slide must advance.
    await pause.blur()
    await expect(hero.getByRole("button", { name: /^Show slide 2/ })).toHaveAttribute("aria-current", "true", { timeout: 12_000 })
  })
})
