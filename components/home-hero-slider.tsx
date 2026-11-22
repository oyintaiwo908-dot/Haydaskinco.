"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion"
import { cn } from "@/lib/utils"

/**
 * One product packshot in a banner. Files live in public/hero/ as `<file>-440.webp` and `<file>-720.webp`
 * (WebP, lossless alpha; AVIF alpha came out grainy). Sources: public/hero/SOURCES.md. Placement is a percentage of
 * the product stage: x = centre, y = bottom, h = height. `m` is the phone composition, `d` the
 * desktop one, so each is art-directed rather than one picture cropped.
 */
type Item = {
  file: string
  name: string
  href: string
  /** Intrinsic sizes of the 440 and 720 renditions (some sources are smaller than 720). */
  small: [number, number]
  large: [number, number]
  m: { x: number; y: number; h: number; r?: number; z?: number }
  d: { x: number; y: number; h: number; r?: number; z?: number }
}

type Slide = {
  key: string
  eyebrow: string
  title: [string, string]
  subtitle: string
  cta: string
  href: string
  /** Background treatment, see .hero-banner[data-tone] in globals.css. */
  tone: "blush" | "sun" | "mist"
  items: Item[]
}

const HERO_SLIDES: Slide[] = [
  {
    key: "concerns",
    eyebrow: "Shop by concern",
    title: ["Dark Spots. Acne. Dryness.", "We Have Your Fix."],
    subtitle: "Find the right products for your skin concern.",
    cta: "Shop By Concern",
    href: "/shop?filter=concerns",
    tone: "blush",
    items: [
      {
        file: "medicube-pdrn-pink-toner",
        name: "Medicube PDRN Pink Niacinamide Milky Toner",
        href: "/product/medicube-pdrn-pink-niacinamide-milky-toner",
        small: [351, 440],
        large: [574, 720],
        m: { x: 47, y: 7, h: 88 },
        d: { x: 45, y: 8, h: 84 },
      },
      {
        file: "boj-glow-deep-serum",
        name: "Beauty of Joseon Glow Deep Serum: Rice + Alpha-Arbutin",
        href: "/product/beauty-of-joseon-glow-deep-serum-rice-alpha-arbutin-30ml",
        small: [191, 440],
        large: [294, 676],
        m: { x: 15, y: 4, h: 50, z: 2 },
        d: { x: 18, y: 5, h: 48, z: 2 },
      },
      {
        file: "cosrx-salicylic-cleanser",
        name: "COSRX Salicylic Acid Daily Gentle Cleanser",
        href: "/product/cosrx-salicylic-acid-daily-gentle-cleanser-150ml",
        small: [175, 440],
        large: [268, 675],
        m: { x: 83, y: 4, h: 70, r: 4, z: 1 },
        d: { x: 77, y: 6, h: 70, r: 4, z: 1 },
      },
      {
        file: "cosrx-hyaluronic-cream",
        name: "COSRX Hyaluronic Hydra Intensive Cream",
        href: "/product/cosrx-hyaluronic-hydra-intensive-cream-100ml",
        small: [583, 392],
        large: [583, 392],
        m: { x: 62, y: 0, h: 25, z: 3 },
        d: { x: 60, y: 1, h: 24, z: 3 },
      },
    ],
  },
  {
    key: "spf",
    eyebrow: "Sun protection",
    title: ["SPF Every", "Single Day"],
    subtitle: "Daily sunscreens from Black Girl Sunscreen, COSRX and CeraVe.",
    cta: "Shop sunscreen",
    href: "/shop?category=sunscreens",
    tone: "sun",
    items: [
      {
        file: "cosrx-aloe-sun-cream",
        name: "COSRX Aloe Soothing Sun Cream SPF 50",
        href: "/product/cosrx-aloe-soothing-sun-cream-spf-50",
        small: [180, 440],
        large: [277, 677],
        m: { x: 26, y: 6, h: 72, r: -7, z: 1 },
        d: { x: 28, y: 8, h: 72, r: -7, z: 1 },
      },
      {
        file: "cerave-invisible-sunscreen",
        name: "CeraVe Invisible Hydrating Sunscreen SPF 50",
        href: "/product/cerave-invisible-hydrating-sunscreen-spf-50",
        small: [176, 421],
        large: [176, 421],
        m: { x: 75, y: 6, h: 66, r: 7, z: 1 },
        d: { x: 72, y: 8, h: 66, r: 7, z: 1 },
      },
      {
        file: "black-girl-sunscreen-spf30",
        name: "Black Girl Sunscreen Broad Spectrum SPF 30",
        href: "/product/black-girl-sunscreen-broad-spectrum-spf-30",
        small: [204, 440],
        large: [311, 671],
        m: { x: 50, y: 3, h: 82, z: 2 },
        d: { x: 50, y: 4, h: 82, z: 2 },
      },
    ],
  },
  {
    key: "serums",
    eyebrow: "Serums & treatments",
    title: ["Find Your", "Next Serum"],
    subtitle: "Serums from Beauty of Joseon, COSRX and La Roche-Posay.",
    cta: "Shop serums",
    href: "/shop?category=serums-treatment",
    tone: "mist",
    items: [
      {
        file: "boj-glow-serum",
        name: "Beauty of Joseon Glow Serum: Propolis + Niacinamide",
        href: "/product/beauty-of-joseon-glow-serum",
        small: [279, 440],
        large: [361, 569],
        m: { x: 21, y: 5, h: 58, z: 1 },
        d: { x: 24, y: 6, h: 58, z: 1 },
      },
      {
        file: "lrp-hyalu-b5",
        name: "La Roche-Posay Hyalu B5 Suractivated Serum",
        href: "/product/la-roche-posay-hyalu-b5-suractivated-serum",
        small: [137, 440],
        large: [225, 720],
        m: { x: 79, y: 5, h: 72, z: 1 },
        d: { x: 76, y: 6, h: 72, z: 1 },
      },
      {
        file: "cosrx-vitamin-c-23",
        name: "COSRX The Vitamin C 23 Serum",
        href: "/product/cosrx-the-vitamin-c-23-serum",
        small: [146, 440],
        large: [179, 539],
        m: { x: 50, y: 3, h: 76, z: 2 },
        d: { x: 50, y: 4, h: 76, z: 2 },
      },
    ],
  },
]

/** Product stage heights the `sizes` hints assume (CSS: .hero-stage-box). */
const STAGE_H = { m: 300, d: 540 }
const AUTOPLAY_MS = 7000

/**
 * Home hero: image-led campaign banners composed from real catalogue packshots over soft light
 * backgrounds with leaf shadows. Copy is real HTML (one persistent sr-only h1; slide titles are
 * h2s). Autoplay with previous/next, dots and swipe. No pause button (client decision); autoplay
 * pauses while the pointer is over the hero, while keyboard focus is inside it, off-screen and in
 * a hidden tab, and never runs under reduced motion. Without JS, slide 1 shows, whole.
 */
export function HomeHeroSlider() {
  const n = HERO_SLIDES.length
  const [active, setActive] = useState(0)
  const [hover, setHover] = useState(false)
  const [keyboardFocus, setKeyboardFocus] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const [visible, setVisible] = useState(true)
  const [manualNav, setManualNav] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const running = !reducedMotion && !hover && !keyboardFocus && visible && pageVisible

  const goTo = useCallback((index: number) => setActive(((index % n) + n) % n), [n])
  const goToByUser = (index: number) => {
    setManualNav(true)
    goTo(index)
  }

  useEffect(() => {
    if (!running) return
    const t = window.setTimeout(() => {
      setManualNav(false) // autoplay steps are not announced
      goTo(active + 1)
    }, AUTOPLAY_MS)
    return () => window.clearTimeout(t)
  }, [running, active, goTo])

  useEffect(() => {
    const onChange = () => setPageVisible(document.visibilityState === "visible")
    onChange()
    document.addEventListener("visibilitychange", onChange)
    return () => document.removeEventListener("visibilitychange", onChange)
  }, [])

  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="hero relative isolate overflow-hidden bg-porcelain"
      aria-roledescription="carousel"
      aria-label="Featured campaigns"
      onPointerEnter={(e: PointerEvent<HTMLElement>) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocusCapture={e => setKeyboardFocus((e.target as Element).matches?.(":focus-visible") ?? false)}
      onBlurCapture={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyboardFocus(false)
      }}
    >
      {/* One persistent page heading; slide titles are h2s, so the outline never loses its h1. */}
      <h1 className="sr-only">HAYDA SKINCo.: authentic skincare from trusted brands, delivered across Nigeria</h1>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {manualNav ? `Slide ${active + 1} of ${n}: ${HERO_SLIDES[active].title.join(" ")}` : ""}
      </p>

      <div
        className="hero-stage"
        onPointerDown={e => {
          if (e.pointerType === "mouse") return
          swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
        }}
        onPointerUp={e => {
          const start = swipe.current
          swipe.current = null
          if (!start || start.id !== e.pointerId) return
          const dx = e.clientX - start.x
          const dy = e.clientY - start.y
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) goToByUser(active + (dx < 0 ? 1 : -1))
        }}
        onPointerCancel={() => (swipe.current = null)}
      >
        {HERO_SLIDES.map((slide, i) => {
          const isActive = i === active
          return (
            <div
              key={slide.key}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${n}: ${slide.title.join(" ")}`}
              inert={!isActive}
              data-active={isActive || undefined}
              data-tone={slide.tone}
              className="hero-slide hero-banner"
            >
              <div className="relative mx-auto grid max-w-7xl grid-cols-1 px-5 pt-7 sm:pt-10 pb-16 lg:min-h-[min(82svh,660px)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center lg:gap-6 lg:px-8 lg:py-12">
                <div className="relative z-10 text-navy-deep">
                  <p className="hero-fade flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.26em] text-rose" style={{ "--i": 0 } as CSSProperties}>
                    <span aria-hidden className="h-px w-8 bg-rose/70" />
                    {slide.eyebrow}
                  </p>
                  <h2 className="mt-3 font-serif text-[clamp(2rem,1.25rem+3.4vw,4.4rem)] font-normal leading-[1.02] tracking-[-0.015em] sm:mt-4">
                    <span className="hero-line-mask">
                      <span className="hero-line italic text-rose" style={{ "--i": 0 } as CSSProperties}>
                        {slide.title[0]}
                      </span>
                    </span>{" "}
                    <span className="hero-line-mask">
                      <span className="hero-line" style={{ "--i": 1 } as CSSProperties}>
                        {slide.title[1]}
                      </span>
                    </span>
                  </h2>
                  <p className="hero-fade mt-3 max-w-md text-[15px] leading-relaxed text-navy-deep/85 sm:mt-5 sm:text-lg" style={{ "--i": 1 } as CSSProperties}>
                    {slide.subtitle}
                  </p>
                  <div className="hero-fade mt-5 sm:mt-8" style={{ "--i": 2 } as CSSProperties}>
                    <Link
                      href={slide.href}
                      prefetch={false}
                      className={cn(buttonVariants({ variant: "primary", size: "lg" }), "btn-sheen min-h-12 px-6 sm:min-h-14 sm:px-8")}
                    >
                      {slide.cta} <ArrowRight aria-hidden />
                    </Link>
                  </div>
                </div>

                {/* The banner's product group, composed from catalogue packshots. */}
                <div className="hero-stage-box relative -mx-5 mt-2 lg:mx-0 lg:mt-0">
                  <span aria-hidden className="hero-glow" />
                  {slide.items.map((item, k) => (
                    <Link
                      key={item.file}
                      href={item.href}
                      prefetch={false}
                      className="hero-item"
                      aria-label={item.name}
                      style={
                        {
                          "--k": k,
                          "--mx": `${item.m.x}%`,
                          "--my": `${item.m.y}%`,
                          "--mh": `${item.m.h}%`,
                          "--mr": `${item.m.r ?? 0}deg`,
                          "--mz": item.m.z ?? 0,
                          "--dx": `${item.d.x}%`,
                          "--dy": `${item.d.y}%`,
                          "--dh": `${item.d.h}%`,
                          "--dr": `${item.d.r ?? 0}deg`,
                          "--dz": item.d.z ?? 0,
                        } as CSSProperties
                      }
                    >
                      <span aria-hidden className="hero-item-shadow" />
                      <picture>
                        <source
                          type="image/webp"
                          srcSet={`/hero/${item.file}-440.webp ${item.small[0]}w, /hero/${item.file}-720.webp ${item.large[0]}w`}
                          sizes={sizesFor(item)}
                        />
                        <Image
                          src={`/hero/${item.file}-440.webp`}
                          alt=""
                          width={item.small[0]}
                          height={item.small[1]}
                          priority={i === 0 && k === 0}
                          loading={i === 0 ? "eager" : "lazy"}
                          fetchPriority={i === 0 && k === 0 ? "high" : undefined}
                          className="hero-item-img"
                        />
                      </picture>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Controls (JS only: they would do nothing without it). No pause button, by request. */}
      <div className="js-only absolute inset-x-0 bottom-3 z-20 mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 lg:bottom-7 lg:px-8">
        <div className="flex items-center rounded-control bg-white/85 px-1">
          {HERO_SLIDES.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              onClick={() => goToByUser(i)}
              aria-label={`Show slide ${i + 1}: ${slide.title.join(" ")}`}
              aria-current={i === active ? "true" : undefined}
              className="flex h-11 w-9 items-center justify-center"
            >
              <span className="relative block h-0.5 w-7 overflow-hidden bg-navy/55">
                <span
                  className={cn(
                    "absolute inset-0 origin-left bg-navy",
                    i === active ? (running ? "hero-progress-run" : "scale-x-100") : "scale-x-0",
                  )}
                  style={i === active && running ? { animationDuration: `${AUTOPLAY_MS}ms` } : undefined}
                />
              </span>
            </button>
          ))}
          <span aria-hidden className="hidden px-2 font-serif text-base tabular-nums text-navy-deep sm:inline">
            {String(active + 1).padStart(2, "0")}
            <span className="text-navy/60"> / {String(n).padStart(2, "0")}</span>
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => goToByUser(active - 1)}
            className="flex size-11 items-center justify-center rounded-control bg-white/85 text-navy transition-colors hover:bg-white"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => goToByUser(active + 1)}
            className="flex size-11 items-center justify-center rounded-control bg-white/85 text-navy transition-colors hover:bg-white"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>
      </div>
    </section>
  )
}

/** `sizes` from the item's rendered width on each layout (stage height x height % x aspect). */
function sizesFor(item: Item) {
  const aspect = item.small[0] / item.small[1]
  const d = Math.round(STAGE_H.d * (item.d.h / 100) * aspect)
  const m = Math.round(STAGE_H.m * (item.m.h / 100) * aspect)
  return `(min-width: 1024px) ${d}px, ${m}px`
}
