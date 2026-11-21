import { test, expect, PDP_PATH } from "./fixtures"

test.describe("320px wide screens", () => {
  test.use({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true })

  for (const path of ["/", "/shop", PDP_PATH, "/checkout"]) {
    test(`no horizontal scroll on ${path}`, async ({ page }) => {
      await page.goto(path)
      await page.evaluate(() => document.fonts.ready)
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })
  }

  test("primary action on the product page fits on screen", async ({ page }) => {
    await page.goto(PDP_PATH)
    const box = await page.getByRole("main").getByRole("button", { name: "Add to cart", exact: true }).first().boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  })
})
