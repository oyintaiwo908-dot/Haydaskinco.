import { test, expect, waitForHydration } from "./fixtures"

const HERO_TITLE_1 = "Dark Spots. Acne. Dryness. We Have Your Fix."

test.describe("home: hero", () => {
  test("renders the image-led hero with its first campaign, and no pause control", async ({ page }) => {
    await page.goto("/")
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    await expect(hero).toBeVisible()
    // One persistent (visually hidden) page h1; each slide title is an h2 in real HTML.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/HAYDA SKINCo/)
    await expect(hero.getByRole("heading", { level: 2, name: HERO_TITLE_1 })).toBeVisible()
    await expect(hero.getByText("Find the right products for your skin concern.")).toBeVisible()
    await expect(hero.getByRole("link", { name: "Shop By Concern" })).toHaveAttribute("href", "/shop?filter=concerns")
    // Client decision: no pause/play button (the hover and focus holds stay, tested below).
    await expect(hero.getByRole("button", { name: /pause|play/i })).toHaveCount(0)
    await expect(hero.getByRole("button", { name: /^Show slide \d/ })).toHaveCount(3)
    await expect(hero.getByRole("button", { name: /^Show slide 1/ })).toHaveAttribute("aria-current", "true")
    await expect(hero.getByRole("button", { name: "Previous slide" })).toBeVisible()
    await expect(hero.getByRole("button", { name: "Next slide" })).toBeVisible()
  })

  test("the first slide's packshots load eagerly with explicit sizes; later slides are lazy", async ({ page }) => {
    await page.goto("/")
    const slides = page.locator(".hero-slide")
    await expect(slides).toHaveCount(3)
    const first = slides.nth(0).locator("img.hero-item-img")
    expect(await first.count()).toBeGreaterThan(1)
    await expect(first.first()).toHaveAttribute("fetchpriority", "high")
    for (const img of await first.all()) {
      await expect(img).not.toHaveAttribute("loading", "lazy")
      await expect(img).toHaveAttribute("width", /\d+/)
      await expect(img).toHaveAttribute("height", /\d+/)
    }
    for (const img of await slides.nth(1).locator("img.hero-item-img").all()) {
      await expect(img).toHaveAttribute("loading", "lazy")
    }
    // Each packshot links to its product, named for assistive tech.
    await expect(slides.nth(0).locator("a.hero-item").first()).toHaveAttribute("href", /^\/product\//)
    await expect(slides.nth(0).locator("a.hero-item").first()).toHaveAttribute("aria-label", /.+/)
  })

  test("autoplay advances with the pointer away", async ({ page }) => {
    await page.goto("/")
    await page.mouse.move(5, 5)
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    await waitForHydration(hero.getByRole("button", { name: "Next slide" }))
    await expect(hero.getByRole("button", { name: /^Show slide 2/ })).toHaveAttribute("aria-current", "true", { timeout: 12_000 })
  })

  test("autoplay holds while the pointer is over the hero, and resumes when it leaves", async ({ page }) => {
    await page.goto("/")
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    const slide1 = hero.getByRole("button", { name: /^Show slide 1/ })
    await waitForHydration(hero.getByRole("button", { name: "Next slide" }))
    const box = (await hero.boundingBox())!
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4)
    // Timers created from here on are fake; while hovering, none may advance the slide.
    await page.clock.install()
    await page.clock.fastForward(20_000)
    await page.clock.runFor(1_000)
    await expect(slide1).toHaveAttribute("aria-current", "true")
    await page.mouse.move(5, 5)
    await page.clock.runFor(8_000)
    await expect(hero.getByRole("button", { name: /^Show slide 2/ })).toHaveAttribute("aria-current", "true")
  })

  test("autoplay holds while keyboard focus is inside the hero", async ({ page }) => {
    await page.goto("/")
    await page.mouse.move(5, 5)
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    const cta = hero.getByRole("link", { name: "Shop By Concern" })
    await waitForHydration(hero.getByRole("button", { name: "Next slide" }))
    // Keyboard focus (focus-visible): focus the CTA, then Tab to the next control in the hero.
    await cta.focus()
    await page.keyboard.press("Tab")
    expect(await page.evaluate(() => document.activeElement?.closest("section")?.getAttribute("aria-label"))).toBe("Featured campaigns")
    await page.clock.install()
    await page.clock.fastForward(20_000)
    await page.clock.runFor(1_000)
    await expect(hero.getByRole("button", { name: /^Show slide 1/ })).toHaveAttribute("aria-current", "true")
  })

  test("autoplay resumes after the visitor clicks a slide control", async ({ page }) => {
    await page.goto("/")
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    const next = hero.getByRole("button", { name: "Next slide" })
    await waitForHydration(next)
    await next.click()
    await page.mouse.move(5, 5)
    await expect(hero.getByRole("button", { name: /^Show slide 2/ })).toHaveAttribute("aria-current", "true")
    await expect(hero.getByRole("button", { name: /^Show slide 3/ })).toHaveAttribute("aria-current", "true", { timeout: 10_000 })
  })

  test("every slide has a real link target and its own title", async ({ page }) => {
    await page.goto("/")
    const hero = page.getByRole("region", { name: "Featured campaigns" })
    const next = hero.getByRole("button", { name: "Next slide" })
    await waitForHydration(next)
    const expected: [string, string][] = [
      [HERO_TITLE_1, "/shop?filter=concerns"],
      ["SPF Every Single Day", "/shop?category=sunscreens"],
      ["Find Your Next Serum", "/shop?category=serums-treatment"],
    ]
    for (const [i, [title, href]] of expected.entries()) {
      if (i > 0) await next.click()
      const slide = hero.getByRole("group", { name: new RegExp(`^${i + 1} of 3`) })
      await expect(slide.getByRole("heading", { level: 2, name: title })).toBeVisible()
      await expect(slide.locator(".hero-fade a").first()).toHaveAttribute("href", href)
    }
  })
})

test.describe("home: sections", () => {
  test("sections run in the agreed order; the promise band and skin-type chips are gone", async ({ page }) => {
    await page.goto("/")
    const main = page.getByRole("main")
    const order = await main.evaluate(el =>
      [...el.querySelectorAll("section")]
        .filter(s => s.parentElement?.closest("section") === null)
        .map(s => s.getAttribute("aria-label") || s.querySelector("h2")?.textContent?.trim() || "?"),
    )
    const want = [
      "Featured campaigns",
      "Shop by Category",
      "What’s your skin concern?",
      "The best sellers",
      "Four steps to skin that behaves",
      "On sale now",
      "From the Journal",
      "HAYDA SKINCo. in numbers",
      "Brands we stock",
      "Every order earns you more",
    ]
    const found = order.map(o => want.find(w => o.includes(w)) ?? o)
    expect(found.filter(f => want.includes(f))).toEqual(want)
    await expect(main.getByText("The HAYDA promise")).toHaveCount(0)
    await expect(main.getByText(/Authentic skincare from brands you trust/)).toHaveCount(0)
    await expect(main.getByText("By skin type", { exact: true })).toHaveCount(0)
    await expect(main.locator('a[href^="/shop?skinType="]')).toHaveCount(0)
  })

  test("Shop by Category and the concerns block use the pre-redesign tiles and links", async ({ page }) => {
    await page.goto("/")
    const categories = page.locator("section[aria-labelledby='categories-title']")
    const tiles = categories.locator("a.aspect-3\\/4")
    await expect(tiles).toHaveCount(4)
    const hrefs = await tiles.evaluateAll(as => as.map(a => [a.textContent?.trim(), a.getAttribute("href")]))
    expect(hrefs).toEqual([
      ["Sunscreen", "/shop?category=sunscreens"],
      ["Face Toners", "/shop?category=face-toners-mists"],
      ["Body Moisturizer", "/shop?category=body-moisturizers-oils"],
      ["Serum", "/shop?category=serums-treatment"],
    ])
    const concerns = page.locator("section[aria-labelledby='concerns-title']")
    await expect(concerns.locator('a[href^="/concern/"]')).toHaveCount(6)
    await expect(concerns.getByRole("link", { name: /All Concerns/ })).toHaveAttribute("href", "/shop?filter=concerns")
  })

  test("the journal section sits directly above the stats and brand band", async ({ page }) => {
    await page.goto("/")
    const journal = page.locator("section[aria-labelledby='journal-title']")
    await expect(journal).toBeAttached()
    expect(await journal.evaluate(el => el.nextElementSibling?.getAttribute("aria-label"))).toBe("HAYDA SKINCo. in numbers")
  })
})

test.describe("home: announcement bar", () => {
  test("scrolls continuously leftwards (transform marquee), seamless, and pauses on hover and focus", async ({ page }) => {
    await page.goto("/")
    const bar = page.getByRole("region", { name: /Announcements/ })
    const track = bar.locator(".announce-track")
    await expect(page.getByRole("list", { name: "Store announcements" }).getByRole("listitem").first()).toHaveText(
      "Launching soon. We're still working on the site",
    )
    // Two copies, one hidden from assistive tech: the loop moves exactly one copy.
    await expect(track.locator("ul")).toHaveCount(2)
    await expect(track.locator("ul[aria-hidden='true']")).toHaveCount(1)
    expect(await track.evaluate(el => getComputedStyle(el).animationName)).toBe("marquee")
    const x = () => track.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41)
    const a = await x()
    await page.waitForTimeout(600)
    expect(await x()).toBeLessThan(a) // moving left
    // No pause button any more; hover and keyboard focus pause it.
    await expect(bar.getByRole("button")).toHaveCount(0)
    await bar.hover()
    expect(await track.evaluate(el => getComputedStyle(el).animationPlayState)).toBe("paused")
    await page.mouse.move(5, 400)
    await bar.focus()
    expect(await track.evaluate(el => getComputedStyle(el).animationPlayState)).toBe("paused")
  })
})

test.describe("home: mobile layout", () => {
  for (const width of [390, 320]) {
    test(`stats stay one row of three at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await page.goto("/")
      const cols = page.locator(".stats-row > div")
      await expect(cols).toHaveCount(3)
      const boxes = await cols.evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(b => ({ top: b.top, left: b.left, right: b.right })))
      expect(new Set(boxes.map(b => Math.round(b.top))).size).toBe(1)
      expect(boxes[0].right).toBeLessThanOrEqual(boxes[1].left + 1)
      expect(boxes[2].right).toBeLessThanOrEqual(width)
      // Labels wrap to two lines at most.
      for (const dt of await page.locator(".stats-row dt").all()) {
        const lines = await dt.evaluate(el => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)))
        expect(lines).toBeLessThanOrEqual(2)
      }
    })
  }

  test("the ritual is short on a phone, never pinned, and the next section peeks", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    const ritual = page.locator("section[aria-labelledby='ritual-title']")
    await ritual.evaluate(el => el.scrollIntoView({ block: "start" }))
    const height = await ritual.evaluate(el => el.getBoundingClientRect().height)
    expect(height).toBeLessThan(844 * 0.8)
    // Cards scroll sideways with the next one peeking.
    const row = ritual.locator(".ritual-row")
    expect(await row.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)
    const second = await ritual.locator(".ritual-card").nth(1).evaluate(el => el.getBoundingClientRect().left)
    expect(second).toBeLessThan(390)
    // No sticky pinning anywhere in the section.
    expect(await ritual.evaluate(el => [el, ...el.querySelectorAll("*")].some(n => getComputedStyle(n).position === "sticky"))).toBe(false)
    // The section after it is visible at the bottom of the screen.
    const nextTop = await ritual.evaluate(el => el.nextElementSibling!.getBoundingClientRect().top)
    expect(nextTop).toBeLessThan(844 - 40)
  })
})

test.describe("home: basics", () => {
  test("body text renders in Geist, not the browser serif", async ({ page }) => {
    await page.goto("/")
    await page.evaluate(() => document.fonts.ready)
    const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
    expect(family.split(",")[0].replace(/"/g, "").trim()).toBe("Geist")
    expect(family).not.toMatch(/^Times/)
    expect(await page.evaluate(() => document.fonts.check('16px "Geist"'))).toBe(true)
  })

  test("security headers are present on /", async ({ request }) => {
    const res = await request.get("/")
    expect(res.status()).toBe(200)
    const h = res.headers()
    expect(h["x-content-type-options"]).toBe("nosniff")
    expect(h["x-frame-options"]).toBe("DENY")
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin")
    expect(h["permissions-policy"]).toContain("camera=()")
    expect(h["strict-transport-security"]).toContain("max-age=")
    expect(h["content-security-policy-report-only"]).toContain("default-src 'self'")
  })
})
