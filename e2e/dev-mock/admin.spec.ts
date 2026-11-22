import { test, expect, type Page } from "@playwright/test"

/**
 * Admin flows in local mock mode (mock `next dev`; the admin session lives in localStorage).
 * Not covered: the real Supabase writes and RLS behind quick edit, and server-side role checks
 * (in mock mode the server has no session, so the sub-admin redirect here is the client guard;
 * the server-side redirect in the dashboard layout needs a real login).
 */
async function signInAs(page: Page, role: "admin" | "sub_admin") {
  await page.addInitScript(r => {
    localStorage.setItem("hayda_admin", JSON.stringify({ email: "e2e@example.test", name: "E2E", role: r, signedInAt: Date.now() }))
  }, role)
}

/** The admin layout scrolls `.admin-main`. */
const scrollTop = (page: Page) => page.locator(".admin-main").evaluate(el => el.scrollTop)

test.describe("admin (mock mode)", () => {
  test("a sub admin has no Dashboard and lands on Products", async ({ page }) => {
    await signInAs(page, "sub_admin")
    await page.goto("/admin/dashboard")
    await page.waitForURL("**/admin/products", { timeout: 60_000 })
    await expect(page.getByRole("heading", { level: 1, name: "Products" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Products" }).first()).toBeVisible()
  })

  test("a full admin still has the Dashboard", async ({ page }) => {
    await signInAs(page, "admin")
    await page.goto("/admin/products")
    await expect(page.getByRole("heading", { level: 1, name: "Products" })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible()
  })

  test("quick edit changes discount and stock in place, and validates stock", async ({ page }) => {
    await signInAs(page, "admin")
    await page.goto("/admin/products")
    const edit = page.getByRole("button", { name: /^Quick edit discount and stock for / }).first()
    await expect(edit).toBeVisible({ timeout: 60_000 })
    const name = ((await edit.getAttribute("aria-label")) ?? "").replace("Quick edit discount and stock for ", "")
    await edit.click()

    const dialog = page.getByRole("dialog", { name: "Quick edit" })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(name)

    await dialog.getByLabel("Stock quantity").fill("-1")
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(dialog.getByRole("alert")).toHaveText("Stock must be a whole number, 0 or more.")

    await dialog.getByLabel("Discount (%)").fill("15")
    await dialog.getByLabel("Stock quantity").fill("7")
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(dialog).toBeHidden()

    const row = page.locator("tr").filter({ hasText: name }).first()
    await expect(row).toContainText("−15%")
    await expect(row).toContainText("(7)")
  })

  test("returning from an edit page reopens the list with the same search and scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 560 })
    await signInAs(page, "admin")
    await page.goto("/admin/products?archive=all")
    const search = page.getByPlaceholder("Search by name, brand, category…")
    await expect(search).toBeVisible({ timeout: 60_000 })
    await search.fill("e")
    await expect(page).toHaveURL(/[?&]q=e(&|$)/)
    // Wait for the list to settle on the new URL (the router applies the query change async).
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem("admin-list:/admin/products")))
      .toContain("q=e")
    await expect(page.getByRole("link", { name: "Edit product" }).first()).toBeVisible()

    await page.locator(".admin-main").evaluate(el => el.scrollTo({ top: 240 }))
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(200)
    const before = await scrollTop(page)

    await page.getByRole("link", { name: "Edit product" }).last().click()
    await page.waitForURL(/\/admin\/products\/.+\/edit/, { timeout: 60_000 })
    await page.getByRole("button", { name: /Products/ }).first().click()

    await page.waitForURL(/\/admin\/products\?/)
    expect(new URL(page.url()).searchParams.get("q")).toBe("e")
    expect(new URL(page.url()).searchParams.get("archive")).toBe("all")
    await expect(search).toHaveValue("e")
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(before - 30)
  })

  test("journal editor Back returns to the filtered journal list", async ({ page }) => {
    await signInAs(page, "admin")
    await page.goto("/admin/journals?status=published&q=a")
    const edit = page.locator('a[href^="/admin/journals/"][href$="/edit"]').first()
    await expect(edit).toBeVisible({ timeout: 60_000 })
    await edit.click()
    await page.waitForURL(/\/admin\/journals\/.+\/edit/, { timeout: 60_000 })
    await page.getByRole("button", { name: /Journal/ }).first().click()
    await page.waitForURL(/\/admin\/journals\?/)
    const url = new URL(page.url())
    expect(url.searchParams.get("status")).toBe("published")
    expect(url.searchParams.get("q")).toBe("a")
  })
})
