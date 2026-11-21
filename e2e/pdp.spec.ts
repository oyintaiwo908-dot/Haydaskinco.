import { test, expect, PDP_PATH, PDP_NAME } from "./fixtures"

test.describe("product page", () => {
  test("shows only data the record has: key ingredients yes, invented lists and usage no", async ({ page }) => {
    // Mock record: has ingredients, has no how_to_use.
    await page.goto(PDP_PATH)
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(PDP_NAME) })).toBeVisible()
    await expect(page.getByText("Key ingredients", { exact: true })).toBeVisible()
    await expect(page.getByText("How to use", { exact: true })).toHaveCount(0)
    // The old page invented an INCI list under a "Full Ingredient List" heading.
    await expect(page.getByRole("heading", { name: /full ingredient list/i })).toHaveCount(0)
    await expect(page.getByText(/Aqua,/)).toHaveCount(0)
  })

  test("concern and ingredient links resolve to real pages", async ({ page, request }) => {
    await page.goto(PDP_PATH)
    // Open every disclosure so all chips are rendered and visible.
    const closed = page.getByRole("main").locator("details:not([open]) > summary")
    while ((await closed.count()) > 0) await closed.first().click()
    const hrefs = await page
      .getByRole("main")
      .getByRole("link")
      .evaluateAll(links =>
        [...new Set(links.map(a => a.getAttribute("href") || "").filter(h => /^\/(concern|ingredient)\//.test(h)))],
      )
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
      const res = await request.get(href)
      expect(res.status(), href).toBe(200)
    }
  })

  test("gallery controls and quantity are labelled", async ({ page }) => {
    await page.goto(PDP_PATH)
    await expect(page.getByRole("button", { name: "Increase quantity" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Decrease quantity" })).toBeDisabled()
    await expect(page.getByRole("button", { name: /Save .+ to favourites/ }).first()).toBeVisible()
  })
})
