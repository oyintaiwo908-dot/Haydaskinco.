import { test, expect, PDP_PATH } from "./fixtures"

// Runs in the "no-js" project (javaScriptEnabled: false).
test.describe("without JavaScript", () => {
  for (const path of ["/", "/shop", PDP_PATH]) {
    test(`${path}: content, product links, no permanent skeletons`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      const productLinks = page.getByRole("main").locator('a[href^="/product/"]')
      expect(await productLinks.count()).toBeGreaterThan(0)
      await expect(productLinks.first()).toBeVisible()
      // Loading placeholders announce themselves as role=status "Loading …".
      await expect(page.getByRole("status", { name: /Loading/ })).toHaveCount(0)
      // Nothing parked in a hidden streamed boundary waiting for JS to swap it in.
      expect(await page.locator('div[hidden][id^="S:"]').count()).toBe(0)
      const text = await page.getByRole("main").innerText()
      expect(text.length).toBeGreaterThan(300)
    })
  }

  test("hero controls are hidden when they cannot work", async ({ page }) => {
    await page.goto("/")
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    await expect(hero.getByRole("heading", { level: 2, name: "Niacinamide & Beyond" })).toBeVisible()
    await expect(hero.getByRole("button")).toHaveCount(0)
  })

  test("checkout explains that it needs JavaScript", async ({ page }) => {
    await page.goto("/checkout")
    await expect(page.getByText(/Checkout needs JavaScript/)).toBeVisible()
  })
})
