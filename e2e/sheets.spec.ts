import { test, expect, focusStaysInDialog } from "./fixtures"
import type { Locator, Page } from "@playwright/test"

async function expectTrapAndReturn(page: Page, trigger: Locator, dialogName: RegExp | string) {
  await trigger.focus()
  await page.keyboard.press("Enter")
  const dialog = page.getByRole("dialog", { name: dialogName })
  await expect(dialog).toBeVisible()
  await expect.poll(() => focusStaysInDialog(page)).toBe(true)

  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab")
    expect(await focusStaysInDialog(page), `focus after Tab ${i + 1}`).toBe(true)
  }
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Shift+Tab")
    expect(await focusStaysInDialog(page), `focus after Shift+Tab ${i + 1}`).toBe(true)
  }

  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
}

test.describe("sheets", () => {
  test("cart sheet traps focus, closes on Escape and returns focus", async ({ page }) => {
    await page.goto("/")
    await expectTrapAndReturn(page, page.getByRole("button", { name: /^Cart, \d+ items?$/ }), /Your cart/)
  })

  test("search sheet traps focus, closes on Escape and returns focus", async ({ page }) => {
    await page.goto("/")
    await expectTrapAndReturn(page, page.getByRole("banner").getByRole("button", { name: "Search", exact: true }), "Search products")
  })

  test("mobile menu traps focus, closes on Escape and returns focus", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    await expectTrapAndReturn(page, page.getByRole("button", { name: "Open menu" }), "Menu")
  })

  test("closed sheets expose no focusable controls", async ({ page }) => {
    await page.goto("/")
    const focusableInClosed = await page.evaluate(
      () =>
        [...document.querySelectorAll("dialog:not([open])")]
          .flatMap(d => [...d.querySelectorAll("a[href], button, input, select, textarea, [tabindex]")])
          .filter(e => e.getClientRects().length > 0).length,
    )
    expect(focusableInClosed).toBe(0)
  })

  test("Ctrl/Cmd+K opens search with the input focused", async ({ page }) => {
    await page.goto("/")
    await page.keyboard.press("ControlOrMeta+k")
    const dialog = page.getByRole("dialog", { name: "Search products" })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("searchbox", { name: /Search products/ })).toBeFocused()
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
  })
})

test.describe("desktop navigation", () => {
  test("menus open by keyboard and render no links while closed", async ({ page }) => {
    await page.goto("/")
    const nav = page.getByRole("navigation", { name: "Main" })
    const face = nav.getByRole("button", { name: "Face" })
    await expect(face).toHaveAttribute("aria-expanded", "false")
    // Closed menus render nothing, so nothing can be prefetched from them.
    await expect(nav.locator('a[href^="/shop?category="]')).toHaveCount(0)
    await expect(nav.locator('a[href^="/concern/"]')).toHaveCount(0)

    await face.focus()
    await page.keyboard.press("Enter")
    await expect(face).toHaveAttribute("aria-expanded", "true")
    const panel = page.locator(`[id="${await face.getAttribute("aria-controls")}"]`)
    await expect(panel.getByRole("link").first()).toBeVisible()
    expect(await panel.getByRole("link").count()).toBeGreaterThan(0)

    await page.keyboard.press("Tab")
    await expect(panel.getByRole("link").first()).toBeFocused()
    await page.keyboard.press("Escape")
    await expect(face).toHaveAttribute("aria-expanded", "false")
    await expect(face).toBeFocused()
    await expect(nav.locator('a[href^="/shop?category="]')).toHaveCount(0)
  })
})
