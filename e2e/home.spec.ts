import { test, expect, waitForHydration } from "./fixtures"

test.describe("home", () => {
  test("renders the hero carousel with its first campaign", async ({ page }) => {
    await page.goto("/")
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    await expect(hero).toBeVisible()
    // One persistent (visually hidden) page h1; each slide title is an h2.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/HAYDA SKINCo/)
    await expect(hero.getByRole("heading", { level: 2, name: "Niacinamide & Beyond" })).toBeVisible()
    await expect(hero.getByRole("button", { name: "Pause slideshow" })).toBeVisible()
    await expect(hero.getByRole("button", { name: /^Show slide 1/ })).toHaveAttribute("aria-current", "true")
  })

  test("autoplay advances, and the pause control stops it", async ({ page }) => {
    await page.goto("/")
    // Keep the pointer off the hero: hovering pauses autoplay on its own.
    await page.mouse.move(5, 5)
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    const slide2 = hero.getByRole("button", { name: /^Show slide 2/ })

    // Autoplay moves to slide 2 after 6s (waits on the condition, not a fixed sleep).
    await expect(slide2).toHaveAttribute("aria-current", "true", { timeout: 12_000 })

    // Pause by keyboard, so the pointer never enters the hero.
    const pause = hero.getByRole("button", { name: "Pause slideshow" })
    await pause.focus()
    await page.keyboard.press("Enter")
    await expect(hero.getByRole("button", { name: "Play slideshow" })).toBeVisible()
    await page.mouse.move(5, 5)

    // From here on timers are fake: any autoplay timer created after pausing would fire on
    // fast-forward. None may: the slide must not change.
    await page.clock.install()
    await page.clock.fastForward(20_000)
    await page.clock.runFor(1_000)
    await expect(slide2).toHaveAttribute("aria-current", "true")
  })

  test("autoplay advances by itself with the pointer resting over the hero (default context)", async ({ page }) => {
    test.slow() // two autoplay intervals
    await page.goto("/")
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    await waitForHydration(hero.getByRole("button", { name: "Next slide" }))
    // Where a desktop pointer naturally rests: over the hero copy, not on the controls or card.
    const box = (await hero.boundingBox())!
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3)
    // Interval is 7 s; allow one interval plus margin, then check it keeps going.
    await expect(hero.getByRole("button", { name: /^Show slide 2/ })).toHaveAttribute("aria-current", "true", { timeout: 10_000 })
    await expect(hero.getByRole("button", { name: /^Show slide 3/ })).toHaveAttribute("aria-current", "true", { timeout: 10_000 })
  })

  test("autoplay resumes after the visitor clicks a slide control", async ({ page }) => {
    await page.goto("/")
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    const next = hero.getByRole("button", { name: "Next slide" })
    await waitForHydration(next)
    await next.click()
    await page.mouse.move(5, 5)
    await expect(hero.getByRole("button", { name: /^Show slide 2/ })).toHaveAttribute("aria-current", "true")
    await expect(hero.getByRole("button", { name: /^Show slide 3/ })).toHaveAttribute("aria-current", "true", { timeout: 10_000 })
  })

  test("body text renders in Geist, not the browser serif", async ({ page }) => {
    await page.goto("/")
    await page.evaluate(() => document.fonts.ready)
    const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
    expect(family.split(",")[0].replace(/"/g, "").trim()).toBe("Geist")
    expect(family).not.toMatch(/^Times/)
    expect(await page.evaluate(() => document.fonts.check('16px "Geist"'))).toBe(true)
  })

  test("security headers are present on /", async ({ request }) => {
    const res = await request.get("/")
    expect(res.status()).toBe(200)
    const h = res.headers()
    expect(h["x-content-type-options"]).toBe("nosniff")
    expect(h["x-frame-options"]).toBe("DENY")
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin")
    expect(h["permissions-policy"]).toContain("camera=()")
    expect(h["strict-transport-security"]).toContain("max-age=")
    expect(h["content-security-policy-report-only"]).toContain("default-src 'self'")
  })
})
