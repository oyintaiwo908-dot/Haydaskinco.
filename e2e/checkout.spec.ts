import { test, expect, addPdpItemToCart } from "./fixtures"
import type { Page, Route } from "@playwright/test"

/** Puts one item in the local cart through the real UI, then opens checkout. */
async function checkoutWithItem(page: Page) {
  // Waits for hydration before clicking (a click on server markup is lost under CPU load).
  await addPdpItemToCart(page)
  await page.goto("/checkout")
  await expect(page.getByRole("heading", { level: 2, name: "Shipping" })).toBeVisible()
}

/** No test may ever create an order. */
async function forbidOrders(page: Page) {
  const attempts: string[] = []
  await page.route("**/api/orders**", (route: Route) => {
    attempts.push(route.request().url())
    return route.abort()
  })
  return attempts
}

test.describe("checkout", () => {
  test("empty cart shows the empty state, not the form", async ({ page }) => {
    await page.goto("/checkout")
    await expect(page.getByRole("heading", { level: 1, name: "Your cart is empty" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Shop now" })).toBeVisible()
  })

  test("shipping form: labelled required fields block an incomplete form", async ({ page }) => {
    const orders = await forbidOrders(page)
    await checkoutWithItem(page)

    const required = ["First name", "Last name", "Email", "Address", "City", "State"]
    for (const label of required) {
      await expect(page.getByLabel(label, { exact: false }).first()).toHaveAttribute("required", "")
    }
    await expect(page.getByLabel("Postal code (optional)")).not.toHaveAttribute("required", "")
    await expect(page.getByLabel("Email").first()).toHaveAttribute("autocomplete", "email")
    await expect(page.getByLabel(/^Address/)).toHaveAttribute("autocomplete", "address-line1")

    const form = page.locator("form").filter({ has: page.getByRole("heading", { name: "Shipping" }) })
    expect(await form.evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(false)

    await page.getByLabel("First name").fill("Ada")
    await page.getByLabel("Last name").fill("Test")
    await page.getByLabel("Email").first().fill("not-an-email")
    expect(await page.getByLabel("Email").first().evaluate((i: HTMLInputElement) => i.validity.typeMismatch)).toBe(true)
    await page.getByLabel("Email").first().fill("ada@example.test")
    await page.getByLabel(/^Address/).fill("1 Test Street")
    await page.getByLabel("City").fill("Lagos")
    await page.getByLabel("State").fill("Lagos")
    expect(await form.evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(true)

    // Mock mode reads stock from the mock catalogue, so a valid cart can continue.
    await expect(page.getByRole("button", { name: "Continue to payment" })).toBeEnabled()
    expect(orders).toEqual([])
  })

  test("promo UI: one promo code plus one rewards code, a second of a kind replaces the first", async ({ page }) => {
    const orders = await forbidOrders(page)
    // /api/promo answers are stubbed: mock mode has no promo table.
    await page.route("**/api/promo", async route => {
      const { code } = route.request().postDataJSON() as { code: string }
      const reward = code.startsWith("RWD-")
      await route.fulfill({
        json: { valid: true, code, kind: reward ? "reward" : "promo", discount_pct: reward ? 0 : 10, discount_ngn: reward ? 500 : 0 },
      })
    })
    await checkoutWithItem(page)
    const summary = page.getByRole("complementary", { name: "Order summary" })
    const input = summary.getByLabel("Promo code")
    const applied = summary.getByRole("list", { name: "Applied codes" })

    const apply = async (code: string) => {
      await input.fill(code)
      await summary.getByRole("button", { name: "Apply" }).click()
    }

    await apply("SAVE10")
    await expect(applied.getByRole("listitem")).toHaveCount(1)
    await apply("SAVE20")
    await expect(summary.getByText("SAVE20 replaced SAVE10")).toBeVisible()
    await expect(applied.getByRole("listitem")).toHaveCount(1)
    await expect(applied).toContainText("SAVE20")

    await apply("RWD-AAA")
    await expect(applied.getByRole("listitem")).toHaveCount(2)
    await apply("RWD-BBB")
    await expect(summary.getByText(/RWD-BBB replaced RWD-AAA/)).toBeVisible()
    await expect(applied.getByRole("listitem")).toHaveCount(2)
    await expect(applied).toContainText("RWD-BBB")
    await expect(applied).not.toContainText("RWD-AAA")
    await expect(applied).toContainText("SAVE20")

    await expect(summary.getByText("One promo code and one rewards code per order.")).toBeVisible()
    expect(orders).toEqual([])
  })
})
