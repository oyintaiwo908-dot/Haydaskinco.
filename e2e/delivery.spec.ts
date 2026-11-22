import { test, expect, addPdpItemToCart, PDP_PATH } from "./fixtures"
import type { Page, Route } from "@playwright/test"

/**
 * Delivery is not free and is not charged at checkout (owner decision): it is quoted and paid
 * separately after the order. One source for the wording: lib/storefront-copy.ts.
 */
const NOTE = /Delivery is not included in this payment\. It is quoted and paid separately after your order, and our team will contact you to arrange it\./
const FORBIDDEN = /free (standard )?(delivery|shipping)|express (delivery|shipping)|business days|₦3,000/i

async function forbidOrders(page: Page) {
  await page.route("**/api/orders**", (route: Route) => route.abort())
}

const naira = (text: string) => Number(text.replace(/[^0-9]/g, ""))

test.describe("delivery wording and checkout", () => {
  for (const path of ["/", "/shop", PDP_PATH, "/shipping", "/faq", "/terms", "/offers", "/deals", "/login", "/register"]) {
    test(`${path}: no free-delivery, express or delivery-time claims`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator("main")).toBeVisible()
      expect(await page.locator("body").innerText()).not.toMatch(FORBIDDEN)
    })
  }

  test("announcement bar and cart sheet carry the new wording", async ({ page }) => {
    await addPdpItemToCart(page)
    expect(await page.getByRole("list", { name: "Store announcements" }).innerText()).not.toMatch(FORBIDDEN)
    await page.getByRole("button", { name: "Cart, 1 item" }).click()
    const sheet = page.getByRole("dialog", { name: /Your cart/ })
    await expect(sheet.getByText(NOTE)).toBeVisible()
  })

  test("checkout: no shipping choice, the delivery note before payment and on review, total = products + VAT", async ({ page }) => {
    test.slow()
    await forbidOrders(page)
    await addPdpItemToCart(page)
    await page.goto("/checkout")
    await expect(page.getByRole("heading", { level: 2, name: "Shipping" })).toBeVisible()
    await expect(page.getByRole("radio", { name: /express|standard/i })).toHaveCount(0)
    await expect(page.getByRole("main").getByText(NOTE).first()).toBeVisible()

    await page.getByLabel("First name").fill("Ada")
    await page.getByLabel("Last name").fill("Test")
    await page.getByLabel("Email").first().fill("ada@example.test")
    await page.getByLabel(/^Address/).fill("1 Test Street")
    await page.getByLabel("City").fill("Lagos")
    await page.getByLabel("State").fill("Lagos")
    await page.getByRole("button", { name: "Continue to payment" }).click()
    await page.getByRole("button", { name: "Review order" }).click()
    await expect(page.getByRole("heading", { level: 2, name: "Review your order" })).toBeVisible()
    await expect(page.getByRole("main").getByText(NOTE).first()).toBeVisible()

    const totals = page.getByRole("region", { name: "Order total" })
    await expect(totals).toContainText("Delivery")
    await expect(totals).toContainText("Arranged after order")
    // Each line is <div><span>label</span><span>value</span></div>; read the value span only.
    const value = (label: string) =>
      totals.locator("div").filter({ has: page.locator(":scope > span", { hasText: new RegExp(`^${label}`) }) }).last().locator(":scope > span").nth(1)
    const subtotal = naira(await value("Subtotal").innerText())
    const vat = naira(await value("VAT").innerText())
    const total = naira(await value("Total").innerText())
    expect(vat).toBe(Math.round(subtotal * 0.075))
    expect(total).toBe(subtotal + vat)
    expect(await page.locator("main").innerText()).not.toMatch(FORBIDDEN)
  })
})
