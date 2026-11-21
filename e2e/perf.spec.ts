import { test, expect, PDP_PATH } from "./fixtures"
import type { Page } from "@playwright/test"

/**
 * Main-thread and raster budget, production build, idle page. Headless Chromium paints at
 * ~60 fps when nothing is wrong (~180 frames in 3 s). The hero glow used to animate a
 * gradient (custom properties) over an SVG-noise layer, which re-rastered the whole hero
 * every frame and left ~12 frames in 3 s: buttons then stalled on tap.
 */
async function framesIn3s(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ frames: number; longFrames: number }>(resolve => {
        let frames = 0
        let longFrames = 0
        const start = performance.now()
        let last = start
        const tick = (now: number) => {
          if (now - last > 100) longFrames++
          last = now
          frames++
          if (now - start >= 3000) resolve({ frames, longFrames })
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
  )
}

for (const path of ["/", "/shop"]) {
  test(`${path}: at least 100 animation frames in 3 s while idle`, async ({ page }) => {
    await page.goto(path)
    // Idle: after load and hydration, pointer parked off the page content.
    await expect(page.getByRole("button", { name: /^Cart, \d+ items?$/ })).toBeVisible()
    await page.waitForLoadState("networkidle")
    await page.mouse.move(1, 1)
    // Idle = after one-off entrance animations and transitions (headline, product, sheen) end.
    // Infinite ones (light field, marquee) and scroll-linked ones keep running during the count.
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter(a => {
            const t = a.effect?.getComputedTiming()
            // Short, finite, time-based: entrances. (Slide progress bars run for the whole slide.)
            return a.timeline === document.timeline && t?.iterations !== Infinity && Number(t?.endTime) < 4000
          })
          .map(a => a.finished.catch(() => undefined)),
      ),
    )
    const result = await framesIn3s(page)
    console.log(`[perf] ${path} idle: ${result.frames} frames in 3 s, ${result.longFrames} over 100 ms`)
    expect(result.frames, JSON.stringify(result)).toBeGreaterThanOrEqual(100)
    expect(result.longFrames, JSON.stringify(result)).toBeLessThanOrEqual(3)
  })
}

test("only transform and opacity animate on the idle home page", async ({ page }) => {
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  const painting = await page.evaluate(() =>
    document
      .getAnimations()
      .filter(a => a.playState === "running")
      .flatMap(a => {
        const effect = a.effect as KeyframeEffect | null
        const props = effect?.getKeyframes?.().flatMap(k => Object.keys(k)) ?? []
        return props.filter(
          p => !["offset", "easing", "composite", "computedOffset", "transform", "translate", "scale", "rotate", "opacity"].includes(p),
        )
      }),
  )
  // Custom properties animated through @property show up as "--name"; clip-path is a one-off line reveal.
  expect(painting.filter(p => p !== "clipPath" && p !== "clip-path")).toEqual([])
})

for (const path of ["/", "/shop", PDP_PATH]) {
  test(`${path}: hydrates without a mismatch or page error`, async ({ page }) => {
    const problems: string[] = []
    page.on("pageerror", e => problems.push(`pageerror: ${e.message}`))
    page.on("console", m => {
      const text = m.text()
      if (m.type() === "error" && /hydrat|did not match|Minified React error #(418|423|425)/i.test(text)) problems.push(text.slice(0, 500))
    })
    await page.goto(path)
    await expect(page.getByRole("button", { name: /^Cart, \d+ items?$/ })).toBeVisible()
    await page.waitForLoadState("networkidle")
    expect(problems).toEqual([])
  })
}
