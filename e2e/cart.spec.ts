import { test, expect, waitForHydration, PDP_PATH, PDP_NAME } from "./fixtures"

test.describe("add to cart", () => {
  test("from a product card: announced, counted, listed in the cart sheet", async ({ page }) => {
    await page.goto("/shop")
    const add = page.getByRole("button", { name: /^Add .+ to cart$/ }).first()
    const label = (await add.getAttribute("aria-label"))!
    const productName = label.replace(/^Add /, "").replace(/ to cart$/, "")
    await waitForHydration(add)
    await add.click()

    await expect(page.locator("#site-announcer")).toHaveText(`Added ${productName} to cart`)
    const cartButton = page.getByRole("button", { name: "Cart, 1 item" })
    await expect(cartButton).toBeVisible()

    await cartButton.click()
    const sheet = page.getByRole("dialog", { name: /Your cart/ })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole("link", { name: productName })).toBeVisible()
  })

  test("from the product page: announced, counted, listed in the cart sheet", async ({ page }) => {
    await page.goto(PDP_PATH)
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(PDP_NAME) })).toBeVisible()
    const add = page.getByRole("main").getByRole("button", { name: "Add to cart", exact: true }).first()
    await waitForHydration(add)
    await add.click()

    await expect(page.locator("#site-announcer")).toHaveText(new RegExp(`Added 1 × ${PDP_NAME}`))
    await page.getByRole("button", { name: "Cart, 1 item" }).click()
    const sheet = page.getByRole("dialog", { name: /Your cart/ })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole("link", { name: new RegExp(PDP_NAME) })).toBeVisible()
  })
})
