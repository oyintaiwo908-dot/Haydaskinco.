import fs from "node:fs"
import path from "node:path"
import ts from "typescript"
import type { Page, Route } from "@playwright/test"
import {
  test,
  expect,
  contrastOf,
  addPdpItemToCart,
  seedStockIssues,
  waitForHydration,
  PDP_PATH,
} from "./fixtures"

/**
 * One test (or more) per finding of the independent design and accessibility review
 * (scratchpad review/report.md). Titles name the finding they cover.
 */

const NAVY: [number, number, number] = [31, 37, 56]

/** No test may ever create an order. */
async function forbidOrders(page: Page) {
  const attempts: string[] = []
  await page.route("**/api/orders**", (route: Route) => {
    attempts.push(route.request().url())
    return route.abort()
  })
  return attempts
}

/** Lets React commit and the browser paint twice: the state after a click, without a timed wait. */
async function settle(page: Page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
}

test.describe("must fix", () => {
  test("1. no JSX inside string or template literals anywhere in the app source", () => {
    const root = path.resolve(__dirname, "..")
    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) files.push(full)
      }
    }
    for (const dir of ["app", "components", "lib"]) walk(path.join(root, dir))
    expect(files.length).toBeGreaterThan(50)

    // A JSX element written as text: `<Money …`, `<Link>`, `</Foo>`.
    const jsxInText = /<\/?[A-Z][A-Za-z0-9.]*(\s|\/?>)/
    const hits: string[] = []
    for (const file of files) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node) => {
        if (
          ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node) ||
          ts.isTemplateHead(node) ||
          ts.isTemplateMiddle(node) ||
          ts.isTemplateTail(node)
        ) {
          if (jsxInText.test(node.text)) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart())
            hits.push(`${path.relative(root, file)}:${line + 1}`)
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    expect(hits).toEqual([])
  })

  test("1. checkout never renders component markup as text", async ({ page }) => {
    test.slow() // several page loads
    await forbidOrders(page)
    await addPdpItemToCart(page)
    await page.goto("/checkout")
    await expect(page.getByRole("heading", { level: 2, name: "Shipping" })).toBeVisible()
    await expect(page.locator("body")).not.toContainText(/<[A-Z][a-z]+[ />]/)
  })

  test("2. stock and error text reaches 4.5:1 in the checkout summary and the shipping step", async ({ page }) => {
    test.slow() // several page loads
    await forbidOrders(page)
    await seedStockIssues(page)
    await page.goto("/checkout")
    const summary = page.getByRole("complementary", { name: "Order summary" })
    const checks = [
      page.getByRole("status").filter({ hasText: "out of stock or exceed available quantity" }),
      summary.getByText("Some items are unavailable or limited"),
      summary.getByText("Out of stock", { exact: true }),
      summary.getByText("Unavailable", { exact: true }),
      summary.getByRole("button", { name: /^Remove/ }).first(),
    ]
    for (const target of checks) {
      await expect(target).toBeVisible()
      expect(await contrastOf(target), await target.innerText()).toBeGreaterThanOrEqual(4.5)
    }
  })

  test("2. stock text in the cart sheet reaches 4.5:1 and unavailable rows are not dimmed", async ({ page }) => {
    test.slow() // several page loads
    await seedStockIssues(page)
    await page.reload()
    await page.getByRole("button", { name: /^Cart, \d+ items?$/ }).click()
    const sheet = page.getByRole("dialog", { name: /Your cart/ })
    const alert = sheet.getByRole("alert")
    await expect(alert).toHaveText(/Some items are out of stock or limited/)
    // Measure once the sheet has finished sliding in and its rows have faded in (a loaded host
    // once caught them mid-animation, which reads as 1:1).
    await sheet.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))))
    const checks = [
      alert,
      sheet.getByText("Out of stock: remove to continue"),
      // (An over-stock quantity is clamped on load, so "Only N available" cannot be seeded.)
      sheet.getByText("Unavailable", { exact: true }),
    ]
    for (const target of checks) {
      await expect(target).toBeVisible()
      expect(await contrastOf(target), await target.innerText()).toBeGreaterThanOrEqual(4.5)
    }
  })

  test("3. cart sheet: blocked checkout is a real disabled button described by the alert", async ({ page }) => {
    test.slow() // several page loads
    await seedStockIssues(page)
    await page.reload()
    await page.getByRole("button", { name: /^Cart, \d+ items?$/ }).click()
    const sheet = page.getByRole("dialog", { name: /Your cart/ })
    const checkout = sheet.getByRole("button", { name: "Checkout" })
    await expect(checkout).toBeDisabled()
    await expect(checkout).toHaveAccessibleDescription(/Some items are out of stock or limited/)
    await expect(sheet.locator('a[href="/checkout"]')).toHaveCount(0)
  })

  test("4. the home page keeps exactly one h1 while slides change", async ({ page }) => {
    await page.goto("/")
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    const h1 = page.getByRole("heading", { level: 1 })
    await expect(h1).toHaveCount(1)
    await expect(h1).toHaveText(/HAYDA SKINCo/)
    await expect(hero.getByRole("heading", { level: 2, name: "Dark Spots. Acne. Dryness. We Have Your Fix." })).toBeVisible()

    for (const n of [2, 3]) {
      await hero.getByRole("button", { name: "Next slide" }).click()
      await expect(hero.getByRole("button", { name: new RegExp(`^Show slide ${n}`) })).toHaveAttribute("aria-current", "true")
      await expect(h1).toHaveCount(1)
      expect(await page.locator("h1").count()).toBe(1)
    }
  })

  test("5. (superseded) the pause control was removed at the client's request; no control is a toggle", async ({ page }) => {
    // Client decision (round two): no pause button. Its WCAG 2.2.2 mitigations (hold on hover and
    // keyboard focus, no autoplay under reduced motion) are tested in home.spec.ts and
    // reduced-motion.spec.ts.
    await page.goto("/")
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    await expect(hero.getByRole("button", { name: "Next slide" })).toBeVisible()
    await expect(hero.getByRole("button", { name: /pause|play/i })).toHaveCount(0)
    for (const button of await hero.getByRole("button").all()) await expect(button).not.toHaveAttribute("aria-pressed")
  })

  test("6. checkout steps move focus to the new step heading (shipping → payment → review, never submitted)", async ({ page }) => {
    test.slow() // several page loads
    const orders = await forbidOrders(page)
    await addPdpItemToCart(page)
    // Records any frame that showed the empty state or a stock warning while the cart loaded.
    await page.addInitScript(() => {
      const w = window as unknown as { __seen: string[] }
      w.__seen = []
      const watch = [/Your cart is empty/, /Fix stock issues/, /out of stock or exceed/]
      new MutationObserver(() => {
        // innerText: rendered text only (the closed cart sheet holds its own empty state).
        const text = document.querySelector("main")?.innerText || ""
        for (const re of watch) if (re.test(text) && !w.__seen.includes(re.source)) w.__seen.push(re.source)
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true })
    })
    await page.goto("/checkout")

    const cont = page.getByRole("button", { name: "Continue to payment" })
    await expect(cont).toBeEnabled()
    await page.getByLabel("First name").fill("Ada")
    await page.getByLabel("Last name").fill("Test")
    await page.getByLabel("Email").first().fill("ada@example.test")
    await page.getByLabel(/^Address/).fill("1 Test Street")
    await page.getByLabel("City").fill("Lagos")
    await page.getByLabel("State").fill("Lagos")
    await cont.click()

    await expect(page.getByRole("heading", { level: 2, name: "Payment" })).toBeFocused()
    await page.getByRole("button", { name: "Review order" }).click()
    await expect(page.getByRole("heading", { level: 2, name: "Review your order" })).toBeFocused()
    await expect(page.getByText("1 Test Street, Lagos, Lagos")).toBeVisible()
    await expect(page.getByRole("button", { name: /^Pay/ })).toBeEnabled()

    await page.getByRole("button", { name: "Back" }).click()
    await expect(page.getByRole("heading", { level: 2, name: "Payment" })).toBeFocused()

    expect(await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen)).toEqual([])
    expect(orders).toEqual([])
  })
})

test.describe("should fix: accessibility", () => {
  test("hero: slide 2 indicators reach 3:1 even over the darkest colour behind their plate", async ({ page }) => {
    await page.goto("/")
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    await hero.getByRole("button", { name: /^Show slide 2/ }).click()
    await expect(hero.getByRole("button", { name: /^Show slide 2/ })).toHaveAttribute("aria-current", "true")
    const plate = ".rounded-control"
    const inactiveTrack = hero.getByRole("button", { name: /^Show slide 1/ }).locator("span").first()
    const activeBar = hero.getByRole("button", { name: /^Show slide 2/ }).locator("span span")
    for (const base of [NAVY, [255, 255, 255] as [number, number, number]]) {
      expect(await contrastOf(inactiveTrack, "fill", base, plate)).toBeGreaterThanOrEqual(3)
      expect(await contrastOf(activeBar, "fill", base, plate)).toBeGreaterThanOrEqual(3)
    }
  })

  test("hero: manual navigation is announced", async ({ page }) => {
    await page.goto("/")
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    const live = hero.locator('[aria-live="polite"]')
    await expect(live).toHaveText("")
    await hero.getByRole("button", { name: "Next slide" }).click()
    await expect(live).toHaveText("Slide 2 of 3: SPF Every Single Day")
  })

  test("placeholders reach 4.5:1 (search, sign-in)", async ({ page }) => {
    test.slow() // several page loads
    await page.goto("/")
    await page.getByRole("banner").getByRole("button", { name: "Search", exact: true }).click()
    const search = page.getByRole("searchbox", { name: /Search products/ })
    await expect(search).toBeVisible()
    expect(await contrastOf(search, "placeholder")).toBeGreaterThanOrEqual(4.5)

    await page.goto("/login")
    const email = page.getByLabel(/Email/).first()
    await expect(email).toHaveAttribute("placeholder", /.+/)
    expect(await contrastOf(email, "placeholder")).toBeGreaterThanOrEqual(4.5)
  })

  test("product cards: empty stars reach 3:1 and the numeric rating is shown", async ({ page }) => {
    await page.goto("/shop")
    const emptyStar = page.locator("main article svg.fill-transparent").first()
    await expect(emptyStar).toBeAttached()
    // Cards rise in with a scroll-driven fade: measure one that sits mid-viewport.
    await emptyStar.evaluate(el => el.scrollIntoView({ block: "center" }))
    await expect.poll(() => emptyStar.evaluate(el => getComputedStyle(el.closest(".atelier-reveal") ?? el).opacity)).toBe("1")
    expect(await contrastOf(emptyStar)).toBeGreaterThanOrEqual(3)
    await expect(page.getByRole("main").locator("article").first()).toContainText(/\d\.\d \(\d+\)/)
  })

  test("add to cart: the status region exists before the click and is reused", async ({ page }) => {
    await page.goto("/shop")
    const announcer = page.locator("#site-announcer")
    await expect(announcer).toHaveAttribute("role", "status")
    await expect(announcer).toHaveText("")
    await announcer.evaluate(el => el.setAttribute("data-e2e-marker", "1"))
    const add = page.getByRole("button", { name: /^Add .+ to cart$/ }).first()
    await waitForHydration(add)
    await add.click()
    await expect(announcer).toHaveText(/Added .+ to cart/)
    await expect(announcer).toHaveAttribute("data-e2e-marker", "1")
    expect(await page.locator('[role="status"][aria-live="polite"]').filter({ hasText: /Added/ }).count()).toBe(1)
  })

  test("search: one status element stays mounted while results change", async ({ page }) => {
    await page.goto("/")
    await page.keyboard.press("ControlOrMeta+k")
    const dialog = page.getByRole("dialog", { name: "Search products" })
    const status = dialog.getByRole("status")
    await expect(status).toHaveCount(1)
    await status.evaluate(el => el.setAttribute("data-e2e-marker", "1"))
    await dialog.getByRole("searchbox").fill("cerave")
    await expect(status).toHaveText(/\d+ results?|No results/)
    await dialog.getByRole("searchbox").fill("zzzzqqq")
    await expect(status).toHaveText(/No results|0 results/)
    await expect(status).toHaveAttribute("data-e2e-marker", "1")
    await expect(dialog.getByRole("status")).toHaveCount(1)
  })

  test("product page: sizes are one radio group with arrow-key selection", async ({ page }) => {
    await page.goto(PDP_PATH)
    const group = page.getByRole("group", { name: /^Size/ })
    const radios = group.getByRole("radio")
    await expect(radios).toHaveCount(3)
    await expect(group.getByRole("button")).toHaveCount(0)
    await group.getByText("473ml", { exact: true }).click()
    await expect(group.getByRole("radio", { name: /473ml/ })).toBeChecked()
    await group.getByRole("radio", { name: /473ml/ }).focus()
    await page.keyboard.press("ArrowRight")
    await expect(group.getByRole("radio", { name: /1L/ })).toBeChecked()
    await expect(group.getByRole("radio", { name: /473ml/ })).not.toBeChecked()
  })

  test("desktop nav: a menu opened by hover stays open when its button is then clicked", async ({ page }) => {
    await page.goto("/")
    const face = page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Face" })
    await face.hover()
    await expect(face).toHaveAttribute("aria-expanded", "true")
    await face.click()
    await settle(page)
    await expect(face).toHaveAttribute("aria-expanded", "true")
    // A second click is a deliberate toggle.
    await face.click()
    await expect(face).toHaveAttribute("aria-expanded", "false")
  })

  test("sheets: a drag that starts in the panel and ends on the backdrop does not close it", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: /^Cart, \d+ items?$/ }).click()
    const sheet = page.getByRole("dialog", { name: /Your cart/ })
    await expect(sheet).toBeVisible()
    // Measure after the slide-in: mid-transition the panel is further right than it ends up.
    await sheet.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
    const panel = (await sheet.boundingBox())!
    const inside = { x: panel.x + panel.width / 2, y: panel.y + 40 }
    const outside = { x: 10, y: panel.y + 40 }

    await page.mouse.move(inside.x, inside.y)
    await page.mouse.down()
    await page.mouse.move(outside.x, outside.y, { steps: 5 })
    await page.mouse.up()
    await settle(page)
    await expect(sheet).toBeVisible()

    // A real backdrop click (press and release outside the panel) still closes it.
    await page.mouse.click(outside.x, outside.y)
    await expect(sheet).toBeHidden()
  })

  test("newsletter prompt waits while another dialog is open", async ({ page }) => {
    // Undo the suite-wide "already dismissed" flag for this test only.
    await page.addInitScript(() => window.sessionStorage.removeItem("hayda_newsletter_dismissed"))
    await page.clock.install()
    await page.goto("/")
    await page.getByRole("button", { name: /^Cart, \d+ items?$/ }).click()
    const cart = page.getByRole("dialog", { name: /Your cart/ })
    await expect(cart).toBeVisible()

    await page.clock.runFor(45_000)
    await settle(page)
    await expect(page.getByRole("dialog", { name: "Early access to new arrivals" })).toHaveCount(0)

    await page.keyboard.press("Escape")
    await expect(cart).toBeHidden()
    await page.clock.runFor(11_000)
    await expect(page.getByRole("dialog", { name: "Early access to new arrivals" })).toBeVisible()
  })
})

test.describe("should fix: layout, behaviour, design", () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    test(`/shop does not jump when the grid hydrates (${viewport.width}px)`, async ({ browser, baseURL }) => {
      test.slow() // two fresh contexts
      const firstCardTop = async (javaScriptEnabled: boolean) => {
        const context = await browser.newContext({ baseURL, viewport, javaScriptEnabled })
        await context.route(/\.(png|jpe?g|webp|avif)(\?.*)?$/, route => route.abort())
        const page = await context.newPage()
        await page.goto("/shop")
        // With JS, wait for the interactive toolbar (only ShopGrid gives the sort control an id).
        if (javaScriptEnabled) await expect(page.locator("#shop-sort")).toBeAttached()
        const top = await page.getByRole("main").locator("article").first().evaluate(el => el.getBoundingClientRect().top + window.scrollY)
        await context.close()
        return top
      }
      const staticTop = await firstCardTop(false)
      const hydratedTop = await firstCardTop(true)
      expect(Math.abs(hydratedTop - staticTop), `static ${staticTop}px, hydrated ${hydratedTop}px`).toBeLessThanOrEqual(2)
    })
  }

  test("/shop toolbar at 390: Filters and Sort share one row", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/shop")
    const filters = page.getByRole("button", { name: /^Filters/ })
    const sort = page.getByLabel("Sort")
    const [a, b] = [(await filters.boundingBox())!, (await sort.boundingBox())!]
    expect(Math.abs(a.y + a.height / 2 - (b.y + b.height / 2))).toBeLessThanOrEqual(4)
    expect(b.x + b.width).toBeLessThanOrEqual(390)
  })

  test("checkout shows a loading state, never the empty cart, before the cart loads", async ({ page }) => {
    test.slow() // several page loads
    await addPdpItemToCart(page)
    await page.addInitScript(() => {
      const w = window as unknown as { __sawEmpty: boolean }
      w.__sawEmpty = false
      new MutationObserver(() => {
        if ((document.querySelector("main")?.innerText || "").includes("Your cart is empty")) w.__sawEmpty = true
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true })
    })
    const html = await (await page.request.get("/checkout")).text()
    // The closed cart sheet carries its own empty state; the page heading must not be one.
    expect(html).not.toMatch(/<h1[^>]*>Your cart is empty/)
    await page.goto("/checkout")
    await expect(page.getByRole("heading", { level: 2, name: "Shipping" })).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __sawEmpty: boolean }).__sawEmpty)).toBe(false)
  })

  test("serif prices and sizes use lining figures", async ({ page }) => {
    await page.goto(PDP_PATH)
    const serif = page.locator("main .font-serif").first()
    await expect(serif).toBeVisible()
    expect(await serif.evaluate(el => getComputedStyle(el).fontVariantNumeric)).toContain("lining-nums")
    const sign = page.locator("main .currency").first()
    expect(await sign.evaluate(el => getComputedStyle(el).fontVariantNumeric)).toContain("lining-nums")
  })

  test("checkout header keeps the wordmark on one line at 320px", async ({ page }) => {
    test.slow() // several page loads
    await page.setViewportSize({ width: 320, height: 700 })
    await addPdpItemToCart(page)
    await page.goto("/checkout")
    const home = page.getByRole("link", { name: /HAYDA/ }).first()
    await expect(home).toBeVisible()
    expect(await home.evaluate(el => getComputedStyle(el).whiteSpace)).toBe("nowrap")
    const box = (await home.boundingBox())!
    const lineHeight = await home.evaluate(el => parseFloat(getComputedStyle(el).lineHeight) || 24)
    expect(box.height).toBeLessThan(lineHeight * 1.6)
  })

  test("page language is en-NG", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("html")).toHaveAttribute("lang", "en-NG")
  })
})
