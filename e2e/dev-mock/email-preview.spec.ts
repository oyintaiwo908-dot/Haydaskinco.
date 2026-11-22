import { test, expect } from "@playwright/test"

/** Email wording: no "glow" lines, and the order confirmation states how delivery works. */
test("admin email preview renders every template, without the old glow lines", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hayda_admin", JSON.stringify({ email: "e2e@example.test", name: "E2E", role: "admin", signedInAt: Date.now() }))
  })
  await page.goto("/admin/email-preview")
  await expect(page.getByRole("heading", { level: 1, name: "Email preview" })).toBeVisible({ timeout: 60_000 })
  const tabs = page.getByRole("navigation").last().getByRole("button")
  const count = await tabs.count()
  expect(count).toBeGreaterThan(3)
  const all: string[] = []
  for (let i = 0; i < count; i++) {
    await tabs.nth(i).click()
    const frame = page.locator("iframe")
    await expect(frame).toHaveAttribute("srcdoc", /<html|<table/i)
    all.push((await frame.getAttribute("srcdoc")) ?? "")
  }
  const html = all.join("\n")
  expect(html).toContain("Your order is confirmed")
  expect(html).toContain("Our team will be in touch to arrange delivery.")
  expect(html).not.toMatch(/glow is on the way|A little glow|glowing skin/i)
  expect(html).not.toMatch(/business days|Estimated delivery/i)
})
