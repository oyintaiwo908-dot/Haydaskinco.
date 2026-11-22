import { test, expect, waitForHydration, addPdpItemToCart, PDP_PATH } from "./fixtures"

/** Behaviour behind the design pass: each test checks that a motion feature works and stays usable. */

test.describe("design: navigation and product", () => {
  test("opening a product from its card starts a view transition that names the image", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __vt: string[][] }
      w.__vt = []
      const original = Document.prototype.startViewTransition
      if (!original) return
      Document.prototype.startViewTransition = function (this: Document, arg?: never) {
        w.__vt.push(
          [...document.querySelectorAll("*")].map(e => getComputedStyle(e).viewTransitionName).filter(n => n && n !== "none"),
        )
        return original.call(this, arg)
      } as typeof original
    })
    await page.goto("/shop")
    const link = page.getByRole("main").locator("article a.card-link").first()
    await waitForHydration(link)
    const href = (await link.getAttribute("href"))!
    await link.click()
    await page.waitForURL(`**${href}`)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    const id = href.split("/").pop()!
    const names = await page.evaluate(() => (window as unknown as { __vt: string[][] }).__vt.flat())
    expect(names).toContain(`product-${id}`)
  })

  test("gallery magnifies under the pointer and resets on leave", async ({ page }) => {
    await page.goto(PDP_PATH)
    const track = page.locator(".gallery-track")
    await waitForHydration(track)
    const box = (await track.boundingBox())!
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3)
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.35)
    const zoom = page.locator("[data-zoom]").first()
    await expect.poll(() => zoom.evaluate(el => el.style.transform)).toContain("scale(2.2)")
    await page.mouse.move(5, 5)
    await expect.poll(() => zoom.evaluate(el => el.style.transform)).toBe("")
  })

  test("the buy panel condenses into a bar once the add-to-cart row scrolls away", async ({ page }) => {
    await page.goto(PDP_PATH)
    const bar = page.locator("[data-buy-bar]")
    await expect(bar).toHaveAttribute("data-buy-bar", "hidden")
    await waitForHydration(page.getByRole("main").getByRole("button", { name: "Add to cart", exact: true }).first())
    // Scroll the add-to-cart row well above the viewport (instant, so the observer sees it).
    // Re-applied while polling: under load the page can still be growing (or the observer still
    // attaching) when the first scroll lands, which clamps it short of the row.
    await expect
      .poll(async () => {
        await page.evaluate(() => window.scrollTo({ top: 1600, behavior: "instant" }))
        return bar.getAttribute("data-buy-bar")
      })
      .toBe("visible")
    await expect(bar.getByRole("button", { name: "Add to cart" })).toBeVisible()
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
    await expect(bar).toHaveAttribute("data-buy-bar", "hidden")
  })

  test("pairs-well-with rail scrolls with its arrow buttons", async ({ page }) => {
    await page.goto(PDP_PATH)
    const rail = page.getByRole("list", { name: "Pairs well with" })
    await rail.scrollIntoViewIfNeeded()
    const forward = page.getByRole("button", { name: "Scroll Pairs well with forward" })
    await waitForHydration(forward)
    const before = await rail.evaluate(el => el.scrollLeft)
    await forward.click()
    await expect.poll(() => rail.evaluate(el => el.scrollLeft)).toBeGreaterThan(before)
  })
})

test.describe("design: cart, search, checkout", () => {
  test("removing a cart line animates it out and updates the count", async ({ page }) => {
    await addPdpItemToCart(page)
    await page.getByRole("button", { name: "Cart, 1 item" }).click()
    const sheet = page.getByRole("dialog", { name: /Your cart/ })
    await expect(sheet.getByRole("listitem")).toHaveCount(1)
    await sheet.getByRole("button", { name: /^Remove .+ from cart$/ }).click()
    await expect(sheet.getByText("Your cart is empty")).toBeVisible()
    await expect(page.getByRole("button", { name: "Cart, 0 items" })).toBeAttached()
  })

  test("the guest cart survives a reload", async ({ page }) => {
    await addPdpItemToCart(page)
    await page.goto("/checkout")
    await expect(page.getByRole("heading", { level: 2, name: "Shipping" })).toBeVisible()
    await page.reload()
    await expect(page.getByRole("heading", { level: 2, name: "Shipping" })).toBeVisible()
  })

  test("search opens as a full-screen overlay with suggestions", async ({ page }) => {
    await page.goto("/")
    await page.keyboard.press("ControlOrMeta+k")
    const dialog = page.getByRole("dialog", { name: "Search products" })
    await expect(dialog).toBeVisible()
    const height = await dialog.evaluate(el => el.getBoundingClientRect().height)
    expect(height).toBeGreaterThanOrEqual(page.viewportSize()!.height - 1)
    await expect(dialog.getByRole("button", { name: "Niacinamide" })).toBeVisible()
    await expect(dialog.getByRole("link", { name: "Serums" })).toBeVisible()
  })

  test("checkout progress fill follows the step", async ({ page }) => {
    await addPdpItemToCart(page)
    await page.route("**/api/orders**", route => route.abort())
    await page.goto("/checkout")
    const fill = page.locator(".step-fill")
    await expect(fill).toHaveAttribute("style", /scaleX\(0\)/)
    await expect(page.getByRole("list", { name: "Checkout progress" }).locator('[aria-current="step"]')).toContainText("Shipping")
  })
})

test.describe("design: serif figures", () => {
  const lining = (el: Element) => getComputedStyle(el).fontVariantNumeric

  test("serif numbers use lining figures (stats, hero counter, ritual, PDP price, receipt total)", async ({ page }) => {
    await page.goto("/")
    const stat = page.locator(".stats-row dd").first()
    await expect(stat).toBeAttached()
    expect(await stat.locator("span[aria-hidden]").first().evaluate(lining)).toContain("lining-nums")
    const counter = page.getByRole("region", { name: "Featured campaigns" }).locator("span.font-serif").first()
    expect(await counter.evaluate(lining)).toContain("lining-nums")
    const ritualNumber = page.locator(".ritual-card span.font-serif[aria-hidden]").first()
    if (await ritualNumber.count()) expect(await ritualNumber.evaluate(lining)).toContain("lining-nums")

    await addPdpItemToCart(page)
    const price = page.getByRole("main").locator("p.font-serif").filter({ hasText: "₦" }).first()
    expect(await price.evaluate(lining)).toContain("lining-nums")

    await page.route("**/api/orders**", route => route.abort())
    await page.goto("/checkout")
    const summary = page.getByRole("complementary", { name: "Order summary" })
    await expect(summary).toBeVisible()
    const total = summary.locator("span.font-serif").last()
    expect(await total.evaluate(lining)).toContain("lining-nums")
  })
})

test.describe("design: white product stage", () => {
  const bg = (el: Element) => getComputedStyle(el).backgroundColor

  test("product photos sit on white: cards, PDP gallery, cart thumbnails", async ({ page }) => {
    await page.goto("/shop")
    // After ShopGrid takes over (the server fallback grid is replaced on hydration).
    await expect(page.locator("#shop-sort")).toBeAttached()
    const card = page.locator("main [data-card-media]").first()
    await expect(card).toBeVisible()
    expect(await card.evaluate(bg)).toBe("rgb(255, 255, 255)")

    await addPdpItemToCart(page)
    expect(await page.locator(".gallery-track").evaluate(bg)).toBe("rgb(255, 255, 255)")
    await page.getByRole("button", { name: "Cart, 1 item" }).click()
    const thumb = page.getByRole("dialog", { name: /Your cart/ }).locator(".product-stage").first()
    expect(await thumb.evaluate(bg)).toBe("rgb(255, 255, 255)")
  })
})
