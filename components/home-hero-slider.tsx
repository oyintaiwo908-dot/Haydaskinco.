"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { useMotionValue, useSpring, useTransform } from "motion/react"
import * as m from "motion/react-m"
import { buttonVariants } from "@/components/ui/button"
import { MotionProvider } from "@/components/motion/motion-provider"
import { Magnetic } from "@/components/motion/magnetic"
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion"
import { cn } from "@/lib/utils"

type Slide = {
  eyebrow: string
  title: [string, string]
  subtitle: string
  cta: string
  href: string
  /** Owner-approved campaign gradients (commit 9ea0dd0); unchanged. */
  gradient: string
  /** Light-field colours drawn from the same gradient. */
  field: [string, string, string]
  /** Text colour that passes AA on this gradient. */
  tone: "light" | "dark"
  /** Light-text slides only: navy scrim strength over the copy band (see .hero-scrim). */
  scrim?: number
  image: { name: string; width: number; height: number }
  productName: string
  productBrand: string
  productHref: string
  /** Short claim on the floating chip. */
  chip: string
}

const HERO_SLIDES: Slide[] = [
  {
    eyebrow: "New arrivals",
    title: ["Niacinamide", "& Beyond"],
    subtitle: "Discover targeted serums and treatments from The Ordinary, COSRX & Paula's Choice.",
    cta: "Shop serums",
    href: "/shop?category=serums-treatment",
    gradient: "from-[#293049] via-[#5C6B86] to-[#FACBD3]",
    field: ["rgb(250 203 211 / 0.7)", "rgb(92 107 134 / 0.8)", "rgb(255 255 255 / 0.4)"],
    tone: "light",
    scrim: 0.45,
    image: { name: "serum", width: 800, height: 800 },
    productName: "Niacinamide 10% + Zinc",
    productBrand: "The Ordinary",
    productHref: "/product/ordinary-niacinamide",
    chip: "Pores · Oil control",
  },
  {
    eyebrow: "Bestsellers",
    title: ["Skin Barrier", "Essentials"],
    subtitle: "CeraVe and La Roche-Posay formulas trusted by dermatologists worldwide.",
    cta: "Shop moisturisers",
    href: "/shop?category=face-moisturizers",
    gradient: "from-[#293049] via-[#FACBD3] to-[#FDF0F3]",
    field: ["rgb(253 240 243 / 0.8)", "rgb(41 48 73 / 0.55)", "rgb(250 203 211 / 0.8)"],
    tone: "light",
    scrim: 0.6,
    image: { name: "cream", width: 800, height: 800 },
    productName: "Moisturising Cream",
    productBrand: "CeraVe",
    productHref: "/product/cerave-moisturising-cream",
    chip: "Ceramides · 24h hydration",
  },
  {
    eyebrow: "Sun protection",
    title: ["SPF Every", "Single Day"],
    subtitle: "Daily sunscreens for Lagos weather, from lightweight fluids to tinted formulas.",
    cta: "Shop sunscreen",
    href: "/shop?category=sunscreens",
    gradient: "from-[#E8919E] via-[#FACBD3] to-[#FDF0F3]",
    field: ["rgb(255 255 255 / 0.75)", "rgb(232 145 158 / 0.7)", "rgb(253 240 243 / 0.9)"],
    tone: "dark",
    image: { name: "sunscreen", width: 800, height: 1067 },
    productName: "Anthelios UVMune SPF 50+",
    productBrand: "La Roche-Posay",
    productHref: "/product/lrp-anthelios-spf50",
    chip: "SPF 50+ · Invisible fluid",
  },
]

const AUTOPLAY_MS = 7000
const SPRING = { stiffness: 110, damping: 18, mass: 0.7 }

/**
 * Home hero. The owner's three gradients, a slow light field (blurred-by-gradient layers that
 * only translate and scale on the compositor), the product large in its white panel with a
 * floor shadow and a spring tilt that follows the pointer. Slides cross-fade as layers with
 * masked headline lines; swipe works on touch. Autoplay is off under reduced motion, pauses
 * on hover or focus, and has a Pause control (WCAG 2.2.2). Without JS slide 1 shows, whole.
 */
export function HomeHeroSlider() {
  return (
    <MotionProvider>
      <Hero />
    </MotionProvider>
  )
}

function Hero() {
  const n = HERO_SLIDES.length
  const [active, setActive] = useState(0)
  // null = follow the default (autoplay unless reduced motion); otherwise the visitor's choice.
  const [userChoice, setUserChoice] = useState<"play" | "pause" | null>(null)
  // Autoplay holds only while it would get in someone's way: the mouse is on the product card or
  // the controls, keyboard focus is inside, the hero is off-screen, or the tab is hidden. (It
  // used to hold whenever the pointer was anywhere over the hero, which on a desktop is most of
  // the first screen, and after any tap on touch, where focus stays on the tapped button.)
  const [hoverHold, setHoverHold] = useState(false)
  const [keyboardFocus, setKeyboardFocus] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const [manualNav, setManualNav] = useState(false)
  const [visible, setVisible] = useState(true)
  const sectionRef = useRef<HTMLElement>(null)
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const autoplayOn = userChoice ? userChoice === "play" : !reducedMotion
  const running = autoplayOn && !hoverHold && !keyboardFocus && visible && pageVisible
  const holdHandlers = {
    onPointerEnter: (e: PointerEvent<HTMLElement>) => e.pointerType === "mouse" && setHoverHold(true),
    onPointerLeave: () => setHoverHold(false),
  }

  // Pointer tilt: raw -1..1 values, smoothed by springs, mapped to small rotations and offsets.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, SPRING)
  const sy = useSpring(py, SPRING)
  const rotateY = useTransform(sx, v => v * 7)
  const rotateX = useTransform(sy, v => v * -6)
  const fieldX = useTransform(sx, v => v * -28)
  const fieldY = useTransform(sy, v => v * -20)
  const photoX = useTransform(sx, v => v * -10)
  const photoY = useTransform(sy, v => v * -8)
  const chipX = useTransform(sx, v => v * 16)
  const chipY = useTransform(sy, v => v * 12)

  // Counts slide changes so the wipe replays on each one (and not on first paint).
  const [changes, setChanges] = useState(0)
  const goTo = useCallback(
    (index: number) => {
      setActive(((index % n) + n) % n)
      setChanges(c => c + 1)
    },
    [n],
  )
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

  // Hidden tab: hold, and start a fresh interval when the visitor comes back. (A timer that
  // fired while hidden used to skip its step and never re-arm, leaving autoplay stuck.)
  useEffect(() => {
    const onChange = () => setPageVisible(document.visibilityState === "visible")
    onChange()
    document.addEventListener("visibilitychange", onChange)
    return () => document.removeEventListener("visibilitychange", onChange)
  }, [])

  // Save-Data: keep the light field still (html[data-save-data] in CSS).
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (connection?.saveData) document.documentElement.dataset.saveData = ""
  }, [])

  // Off-screen: pause autoplay and every light-field animation (data-offscreen in CSS).
  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse" || reducedMotion) return
    const rect = e.currentTarget.getBoundingClientRect()
    px.set(((e.clientX - rect.left) / rect.width) * 2 - 1)
    py.set(((e.clientY - rect.top) / rect.height) * 2 - 1)
  }

  return (
    <section
      ref={sectionRef}
      className="hero relative isolate overflow-hidden bg-navy-deep"
      data-offscreen={visible ? undefined : ""}
      aria-roledescription="carousel"
      aria-label="Featured campaigns"
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        px.set(0)
        py.set(0)
      }}
      onFocusCapture={e => setKeyboardFocus((e.target as Element).matches?.(":focus-visible") ?? false)}
      onBlurCapture={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyboardFocus(false)
      }}
    >
      {/* One persistent page heading; slide titles are h2s, so the outline never loses its h1. */}
      <h1 className="sr-only">HAYDA SKINCo.: authentic skincare from trusted brands, delivered across Nigeria</h1>
      {/* Announces the slide after the visitor moves the carousel (not during autoplay). */}
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
          const dark = slide.tone === "dark"
          return (
            <div
              key={slide.title.join(" ")}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${n}: ${slide.title.join(" ")}`}
              inert={!isActive}
              data-active={isActive || undefined}
              className={cn("hero-slide bg-linear-to-br", slide.gradient)}
              style={
                {
                  "--f1": slide.field[0],
                  "--f2": slide.field[1],
                  "--f3": slide.field[2],
                } as CSSProperties
              }
            >
              <m.div className="light-field" aria-hidden style={isActive ? { x: fieldX, y: fieldY } : undefined}>
                <span />
                <span />
                <span />
              </m.div>
              {/* One veil layer over the moving field: the scrim (light-text slides) carries the grain. */}
              {slide.scrim ? (
                <div className="hero-scrim" aria-hidden style={{ "--scrim": slide.scrim } as CSSProperties} />
              ) : (
                <div className="hero-grain" aria-hidden />
              )}

              <div
                className={cn(
                  "relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-6 px-5 pb-24 pt-7 sm:gap-10 sm:pb-28 sm:pt-10 lg:min-h-[min(88svh,820px)] lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8 lg:py-20",
                  dark ? "text-navy-deep" : "text-on-dark",
                )}
              >
                <div>
                  <p className="hero-fade flex items-center gap-3 text-xs font-medium uppercase tracking-[0.28em]" style={{ "--i": 0 } as CSSProperties}>
                    <span aria-hidden className={cn("h-px w-10", dark ? "bg-navy-deep/60" : "bg-on-dark/70")} />
                    {slide.eyebrow}
                  </p>
                  <h2 className="mt-4 font-serif text-[clamp(2.5rem,1.5rem+4.2vw,5.5rem)] sm:mt-5 font-normal leading-[0.98] tracking-[-0.015em]">
                    <span className="hero-line-mask">
                      <span className="hero-line" style={{ "--i": 0 } as CSSProperties}>{slide.title[0]}</span>
                    </span>{" "}
                    <span className="hero-line-mask">
                      <span className="hero-line italic" style={{ "--i": 1 } as CSSProperties}>{slide.title[1]}</span>
                    </span>
                  </h2>
                  <p
                    className={cn("hero-fade mt-4 line-clamp-2 max-w-md text-sm leading-relaxed sm:mt-6 sm:line-clamp-none sm:text-base md:text-lg", dark ? "text-navy-deep/90" : "text-on-dark/90")}
                    style={{ "--i": 1 } as CSSProperties}
                  >
                    {slide.subtitle}
                  </p>
                  <div className="hero-fade mt-6 flex flex-wrap gap-3 sm:mt-9" style={{ "--i": 2 } as CSSProperties}>
                    <Magnetic>
                      <Link href={slide.href} className={cn(buttonVariants({ variant: dark ? "primary" : "light", size: "lg" }), "btn-sheen min-h-12 px-6 sm:min-h-14 sm:px-8")}>
                        {slide.cta} <ArrowRight aria-hidden />
                      </Link>
                    </Magnetic>
                    <Link href="/shop" className={cn(buttonVariants({ variant: dark ? "outline" : "outline-light", size: "lg" }), "min-h-12 px-6 sm:min-h-14 sm:px-8")}>
                      View all
                    </Link>
                  </div>
                </div>

                {/* Owner's white panel, the photo full-bleed inside it; tilt and parallax follow the pointer. */}
                <div className="hero-product relative mx-auto w-full max-w-[min(70%,15.5rem)] sm:max-w-[24rem] lg:max-w-[30rem]">
                  <div className="hero-floor" aria-hidden />
                  <m.div
                    {...holdHandlers}
                    className="hero-card relative bg-white p-2 shadow-float"
                    style={isActive ? { rotateX, rotateY, transformPerspective: 1100 } : undefined}
                  >
                    <div className="hero-panel relative aspect-4/5 overflow-hidden bg-[#F0F0F0]">
                      <m.div className="absolute -inset-4" style={isActive ? { x: photoX, y: photoY } : undefined}>
                        <picture>
                          <source
                            type="image/avif"
                            srcSet={`/hero/${slide.image.name}-480.avif 480w, /hero/${slide.image.name}-800.avif 800w`}
                            sizes="(max-width: 1024px) 90vw, 480px"
                          />
                          <source
                            type="image/webp"
                            srcSet={`/hero/${slide.image.name}-480.webp 480w, /hero/${slide.image.name}-800.webp 800w`}
                            sizes="(max-width: 1024px) 90vw, 480px"
                          />
                          <Image
                            src={`/hero/${slide.image.name}-800.webp`}
                            alt={slide.productName}
                            width={slide.image.width}
                            height={slide.image.height}
                            priority={i === 0}
                            loading={i === 0 ? "eager" : "lazy"}
                            className="absolute inset-0 size-full object-cover"
                          />
                        </picture>
                      </m.div>
                    </div>
                    <Link
                      href={slide.productHref}
                      prefetch={false}
                      className="group flex w-full items-center justify-between gap-3 px-2 pb-1 pt-3 text-navy-deep"
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-rose">{slide.productBrand}</span>
                        <span className="mt-0.5 block truncate font-serif text-xl leading-tight">{slide.productName}</span>
                      </span>
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-navy/20 transition-colors duration-300 group-hover:border-navy group-hover:bg-navy group-hover:text-on-dark">
                        <ArrowRight aria-hidden className="size-4" />
                      </span>
                    </Link>
                  </m.div>
                  <m.p
                    className="hero-chip absolute -left-3 top-8 hidden items-center gap-2 bg-white/90 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-navy-deep shadow-float sm:flex lg:-left-10"
                    style={isActive ? { x: chipX, y: chipY } : undefined}
                    aria-hidden
                  >
                    <span className="size-1.5 rounded-full bg-rose" />
                    {slide.chip}
                  </m.p>
                  <div className="absolute -right-4 -top-6 size-24 lg:-right-10 lg:size-28" aria-hidden>
                    <svg className="hero-seal absolute inset-0 size-full text-navy-deep" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="49" fill="white" opacity="0.92" />
                      <defs>
                        <path id={`seal-${i}`} d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
                      </defs>
                      <text fontSize="8.6" letterSpacing="1.9" fill="currentColor" fontFamily="var(--font-geist-sans), sans-serif">
                        <textPath href={`#seal-${i}`}>AUTHENTIC · TRUSTED BRANDS ·</textPath>
                      </text>
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center font-serif text-3xl italic text-navy-deep">H</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Slide change: a soft blush band sweeps across (transform only), keyed so it replays. */}
      {changes > 0 && <span key={changes} aria-hidden className="hero-wipe" />}
      <span aria-hidden className={cn("hero-scroll-cue js-only", HERO_SLIDES[active].tone === "dark" ? "text-navy-deep" : "text-on-dark")}>
        <span>Scroll</span>
        <i />
      </span>

      {/* Controls on light plates, so they read on every gradient. Hidden without JS: they would do nothing. */}
      <div className="js-only absolute inset-x-0 bottom-5 z-10 mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 lg:bottom-8 lg:px-8">
        <div {...holdHandlers} className="flex items-center gap-1 rounded-control bg-white/85 pr-1">
          <button
            type="button"
            onClick={() => setUserChoice(autoplayOn ? "pause" : "play")}
            aria-label={autoplayOn ? "Pause slideshow" : "Play slideshow"}
            className="flex size-11 items-center justify-center rounded-control text-navy transition-colors hover:bg-white"
          >
            {autoplayOn ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
          </button>
          {HERO_SLIDES.map((slide, i) => (
            <button
              key={slide.eyebrow}
              type="button"
              onClick={() => goToByUser(i)}
              aria-label={`Show slide ${i + 1}: ${slide.title.join(" ")}`}
              aria-current={i === active ? "true" : undefined}
              className="group flex h-11 w-9 items-center justify-center"
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
          <span aria-hidden className="hidden pl-2 pr-2 font-serif text-base tabular-nums text-navy-deep sm:inline">
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
