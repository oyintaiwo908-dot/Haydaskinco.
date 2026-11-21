import { test, expect, serverRequestsDuring } from "./fixtures"

test.describe("shop filters", () => {
  test("labelled filter updates heading and URL without any server request", async ({ page }) => {
    await page.goto("/shop")
    await expect(page.getByRole("heading", { level: 1, name: "Shop All Skincare" })).toBeVisible()
    const filters = page.getByRole("complementary", { name: "Filters" })
    const skinType = filters.getByLabel("Skin type")

    const requests = await serverRequestsDuring(page, async () => {
      await skinType.selectOption("Oily Skin")
      await expect(page.getByRole("heading", { level: 1, name: "Oily Skin" })).toBeVisible()
      await expect(page).toHaveURL(/[?&]skinType=oily-skin\b/)
    })
    expect(requests, "document or RSC requests during a filter change").toEqual([])
  })

  test("filtered view survives reload and back/forward", async ({ page }) => {
    await page.goto("/shop")
    await page.getByRole("complementary", { name: "Filters" }).getByLabel("Skin type").selectOption("Oily Skin")
    await expect(page).toHaveURL(/skinType=oily-skin/)

    await page.reload()
    await expect(page.getByRole("heading", { level: 1, name: "Oily Skin" })).toBeVisible()
    await expect(page.getByRole("complementary", { name: "Filters" }).getByLabel("Skin type")).toHaveValue("Oily Skin")

    await page.goto("/journal")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Notes on skin")
    await page.goBack()
    await expect(page).toHaveURL(/skinType=oily-skin/)
    await expect(page.getByRole("heading", { level: 1, name: "Oily Skin" })).toBeVisible()
    await page.goForward()
    await expect(page).toHaveURL(/\/journal$/)
  })

  test("sort control is labelled and the product count is announced", async ({ page }) => {
    await page.goto("/shop")
    await expect(page.getByLabel("Sort")).toHaveValue("featured")
    await expect(page.getByText(/^\d+ products?$/)).toBeVisible()
  })
})
