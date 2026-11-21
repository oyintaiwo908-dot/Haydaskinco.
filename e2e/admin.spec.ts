import { test, expect } from "./fixtures"

/**
 * Admin in mock mode on a production build:
 * - proxy.ts redirects every /admin page to /admin/login without an admin auth cookie (307);
 * - production keeps /admin/register closed (redirects to login);
 * - with no Supabase configured, sign-in refuses in production instead of using the
 *   local-development mock login.
 */
test.describe("admin (mock mode, production build)", () => {
  for (const path of ["/admin", "/admin/dashboard", "/admin/orders", "/admin/register"]) {
    test(`${path} redirects to the admin login without a session`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 })
      expect(res.status()).toBe(307)
      expect(new URL(res.headers()["location"], "http://x").pathname).toBe("/admin/login")
    })
  }

  test("login form is labelled and refuses sign-in when auth is not configured", async ({ page }) => {
    await page.goto("/admin")
    await expect(page).toHaveURL(/\/admin\/login$/)
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible()
    await page.getByLabel("Email Address").fill("someone@example.test")
    await page.getByLabel("Password", { exact: true }).fill("not-a-real-password")
    await page.getByRole("button", { name: /Sign in/i }).click()
    await expect(page.getByText("Admin sign-in is not configured.")).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/login$/)
    // No demo credentials are shown anywhere on the page.
    await expect(page.getByText(/demo credentials/i)).toHaveCount(0)
  })
})
