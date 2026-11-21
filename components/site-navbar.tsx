"use client"

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, ArrowUpRight, ChevronRight, Package, Search, ShoppingBag, User, Menu, ChevronDown, LogOut, MessageCircle } from "lucide-react"
import { useCart } from "@/components/cart-provider"
import { useSearch } from "@/components/search-modal"
import { useUserAuth } from "@/components/user-auth-provider"
import { IconButton } from "@/components/ui/icon-button"
import { BrandLogo } from "@/components/brand-logo"
import { Sheet } from "@/components/ui/sheet"
import { Disclosure } from "@/components/ui/disclosure"
import { getCategoryTree, DEFAULT_CATEGORY_TREE, type CategorySection } from "@/lib/supabase/categories"
import { ALL_CONCERNS, ALL_INGREDIENTS, ALL_SKIN_TYPES, slugifyCatalogLabel } from "@/lib/catalog"
import { cn } from "@/lib/utils"
import { whatsAppHref } from "@/lib/whatsapp"

type MenuLink = { label: string; href: string }
type MenuSection = { label: string; items: MenuLink[] }

function treeToSections(tree: CategorySection[]): MenuSection[] {
  return tree
    .map(s => ({
      label: s.name,
      items: s.categories.map(c => ({ label: c.name, href: `/shop?category=${encodeURIComponent(c.slug)}` })),
    }))
    .filter(s => s.items.length > 0)
}

const DIRECT_LINKS = [
  { label: "Brands", href: "/brands" },
  { label: "Deals", href: "/deals" },
  { label: "Offers", href: "/offers", accent: true },
] as const

const SKIN_NEEDS = [
  { label: "By concern", items: ALL_CONCERNS.map(c => ({ label: c, href: `/concern/${slugifyCatalogLabel(c)}` })) },
  { label: "By ingredient", items: ALL_INGREDIENTS.map(i => ({ label: i, href: `/ingredient/${slugifyCatalogLabel(i)}` })) },
  { label: "By skin type", items: ALL_SKIN_TYPES.map(t => ({ label: t, href: `/shop?skinType=${slugifyCatalogLabel(t)}` })) },
]

const EXPLORE = [
  { label: "Journal", href: "/journal" },
  { label: "Wholesale", href: "/wholesale" },
  { label: "About HAYDA", href: "/about" },
  { label: "Contact us", href: "/contact" },
]

/** Featured tile in each mega menu (real catalogue photography). */
const MEGA_FEATURES = [
  { image: "/serum.jpeg", eyebrow: "Treat", label: "Serums that work", href: "/shop?category=serums-treatment" },
  { image: "/moisturizer.jpeg", eyebrow: "Body", label: "Body moisturisers", href: "/shop?category=body-moisturizers-oils" },
  { image: "/toner.jpeg", eyebrow: "Refresh", label: "Toners and mists", href: "/shop?category=face-toners-mists" },
  { image: "/sunscreen.jpeg", eyebrow: "Protect", label: "Daily SPF", href: "/shop?category=sunscreens" },
]

function megaFeatureFor(label: string) {
  if (/face|skin/i.test(label)) return MEGA_FEATURES[0]
  if (/body|bath/i.test(label)) return MEGA_FEATURES[1]
  if (/sun|spf/i.test(label)) return MEGA_FEATURES[3]
  return { image: "/editorial/hero-skincare-720.webp", eyebrow: "Discover", label: "Shop everything", href: "/shop" }
}

const navLinkClass =
  "flex h-11 items-center gap-1 whitespace-nowrap px-2 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors duration-200 xl:px-3"

/**
 * Desktop disclosure menu. The panel (and its links) is rendered only while open, so
 * closed menus never prefetch anything. Opens on click/Enter/Space; hover opens after a
 * short intent delay on fine pointers. Escape closes and returns focus to the trigger.
 */
function NavDisclosure({
  label,
  open,
  onOpenChange,
  align = "start",
  mega = false,
  children,
}: {
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
  align?: "start" | "end"
  /** Full-width panel under the header (positioned against the sticky header). */
  mega?: boolean
  children: ReactNode
}) {
  const panelId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const hoverTimer = useRef<number | undefined>(undefined)
  // A mouse user who hovers (menu opens) and then clicks expects it to stay open.
  const openedByHover = useRef(false)

  function hoverOpen() {
    window.clearTimeout(hoverTimer.current)
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return
    hoverTimer.current = window.setTimeout(() => {
      if (!open) openedByHover.current = true
      onOpenChange(true)
    }, 120)
  }
  function hoverClose() {
    window.clearTimeout(hoverTimer.current)
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return
    hoverTimer.current = window.setTimeout(() => onOpenChange(false), 160)
  }
  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  return (
    <div
      className={mega ? "static" : "relative"}
      onMouseEnter={hoverOpen}
      onMouseLeave={hoverClose}
      onKeyDown={e => {
        if (e.key === "Escape" && open) {
          e.stopPropagation()
          onOpenChange(false)
          triggerRef.current?.focus()
        }
      }}
      onBlur={e => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) onOpenChange(false)
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (open && openedByHover.current) {
            openedByHover.current = false
            return
          }
          openedByHover.current = false
          onOpenChange(!open)
        }}
        className={cn(navLinkClass, "nav-wipe", open ? "text-navy" : "text-foreground/75 hover:text-navy")}
      >
        {label}
        <ChevronDown aria-hidden className={cn("size-3 transition-transform duration-300 ease-atelier", open && "rotate-180")} />
      </button>
      {open && (
        <div
          id={panelId}
          className={cn(
            "absolute top-full z-50 bg-background shadow-float",
            mega ? "mega-panel inset-x-0 border-t border-navy/10" : "nav-panel border border-border",
            !mega && (align === "end" ? "right-0" : "left-0"),
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function SiteNavbar() {
  const { count, openCart } = useCart()
  const { openSearch } = useSearch()
  const { session, signOut } = useUserAuth()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // The mobile menu holds 100+ links. Mount them on first open, not during hydration:
  // they cost main-thread time on every page load for a panel most visits never open.
  const [mobileMounted, setMobileMounted] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [sections, setSections] = useState<MenuSection[]>(() => treeToSections(DEFAULT_CATEGORY_TREE))
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let cancelled = false
    getCategoryTree().then(tree => {
      if (!cancelled && tree.length) setSections(treeToSections(tree))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    // First read on the next frame: reading scrollY inside the hydration commit forced a
    // full style and layout pass while the page was still busy hydrating.
    const frame = requestAnimationFrame(onScroll)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
    }
  }, [])

  // Close desktop menus on outside pointer down
  useEffect(() => {
    if (!openMenu) return
    function onPointerDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [openMenu])

  const setMenu = (label: string) => (open: boolean) =>
    setOpenMenu(current => (open ? label : current === label ? null : current))
  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      <header
        data-condensed={scrolled || undefined}
        className={cn(
          "site-header sticky top-0 z-40 isolate w-full border-b",
          scrolled
            ? "border-navy/10 shadow-[0_12px_40px_-28px_rgb(31_37_56/0.5)] backdrop-blur-md backdrop-saturate-150"
            : "border-transparent",
        )}
      >
        <div className="header-inner mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-2 sm:px-4 lg:h-[72px] lg:grid-cols-[auto_1fr_auto] lg:gap-6 lg:px-8">
          {/* Mobile: menu */}
          <div className="flex items-center lg:hidden">
            <IconButton
              label="Open menu"
              onClick={() => {
                setMobileMounted(true)
                setMobileOpen(true)
              }}
              aria-haspopup="dialog"
            >
              <Menu strokeWidth={1.5} />
            </IconButton>
          </div>

          {/* Logo: centred on mobile, left on desktop */}
          <Link href="/" aria-label="HAYDA SKINCo. home" className="header-logo flex items-center justify-center lg:justify-start">
            <BrandLogo className="h-8 lg:h-10" priority />
          </Link>

          {/* Desktop navigation */}
          <nav ref={navRef} aria-label="Main" className="hidden min-w-0 items-center justify-center lg:flex">
            {sections.map(section => {
              const feature = megaFeatureFor(section.label)
              return (
                <NavDisclosure key={section.label} label={section.label} open={openMenu === section.label} onOpenChange={setMenu(section.label)} mega>
                  <div className="mx-auto grid max-w-7xl grid-cols-[1fr_minmax(0,22rem)] gap-12 px-8 py-10">
                    <div>
                      <p className="mega-item text-xs font-medium uppercase tracking-[0.2em] text-rose" style={{ "--i": 0 } as CSSProperties}>
                        {section.label}
                      </p>
                      {/* prefetch off: menu links render only while the menu is open, and opening one must not fan out into prefetches (Vercel CPU budget). */}
                      <ul className="mt-5 grid max-h-[60vh] grid-cols-2 gap-x-10 overflow-y-auto xl:grid-cols-3">
                        {section.items.map((sub, i) => (
                          <li key={sub.href} className="mega-item" style={{ "--i": i + 1 } as CSSProperties}>
                            <Link
                              href={sub.href}
                              prefetch={false}
                              onClick={() => setOpenMenu(null)}
                              className="group/mega flex items-center justify-between gap-3 border-b border-navy/10 py-3 font-serif text-xl text-navy-deep transition-colors duration-200 hover:text-rose"
                            >
                              <span className="link-wipe">{sub.label}</span>
                              <ArrowRight aria-hidden className="size-4 -translate-x-2 opacity-0 transition-[translate,opacity] duration-300 ease-atelier group-hover/mega:translate-x-0 group-hover/mega:opacity-100" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Link
                      href={feature.href}
                      prefetch={false}
                      onClick={() => setOpenMenu(null)}
                      className="group/feature relative block aspect-4/5 overflow-hidden bg-porcelain"
                    >
                      <Image
                        src={feature.image}
                        alt=""
                        fill
                        sizes="22rem"
                        className="mega-image object-cover transition-[scale] duration-1000 ease-atelier group-hover/feature:scale-105"
                      />
                      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-navy-deep/85 to-transparent" />
                      <span className="absolute inset-x-5 bottom-5 text-on-dark">
                        <span className="block text-[11px] font-medium uppercase tracking-[0.2em]">{feature.eyebrow}</span>
                        <span className="mt-1 flex items-center gap-2 font-serif text-2xl">
                          {feature.label} <ArrowRight aria-hidden className="size-4" />
                        </span>
                      </span>
                    </Link>
                  </div>
                </NavDisclosure>
              )
            })}

            {DIRECT_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(navLinkClass, "nav-wipe", "accent" in link ? "text-rose hover:text-navy" : "text-foreground/75 hover:text-navy")}
              >
                {link.label}
              </Link>
            ))}

            <NavDisclosure label="More" open={openMenu === "More"} onOpenChange={setMenu("More")} align="end">
              <div className="grid w-[min(36rem,80vw)] grid-cols-[1.4fr_1fr]">
                <div className="border-r border-border p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-rose">Skin needs</p>
                  {SKIN_NEEDS.map(group => (
                    <div key={group.label} className="mt-4">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{group.label}</p>
                      <ul className="mt-1 max-h-32 overflow-y-auto pr-1">
                        {/* prefetch off: the concern and ingredient lists are long; render-on-open plus no prefetch keeps menus free (Vercel CPU budget). */}
                        {group.items.map(item => (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              prefetch={false}
                              onClick={() => setOpenMenu(null)}
                              className="block py-1.5 text-sm text-foreground/85 transition-colors hover:text-navy"
                            >
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-rose">Explore</p>
                  <ul className="mt-3">
                    {EXPLORE.map(l => (
                      <li key={l.href}>
                        {/* prefetch off: rendered only while open (Vercel CPU budget). */}
                        <Link
                          href={l.href}
                          prefetch={false}
                          onClick={() => setOpenMenu(null)}
                          className="block py-2 text-sm text-foreground/85 transition-colors hover:text-navy"
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </NavDisclosure>
          </nav>

          {/* Utilities */}
          <div className="flex items-center justify-end">
            <IconButton label="Search" onClick={openSearch} aria-haspopup="dialog">
              <Search strokeWidth={1.5} />
            </IconButton>

            {session ? (
              <div className="hidden items-center sm:flex">
                <Link
                  href="/account"
                  aria-label={`Account for ${session.firstName}`}
                  className="flex h-11 items-center gap-2 px-2 text-xs font-medium text-foreground/85 transition-colors hover:text-navy"
                >
                  <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-primary-foreground">
                    {session.firstName.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden xl:inline">{session.firstName}</span>
                </Link>
                <IconButton label="Sign out" onClick={() => signOut()} size="sm" className="text-muted-foreground hover:text-destructive">
                  <LogOut strokeWidth={1.5} className="size-4" />
                </IconButton>
              </div>
            ) : (
              <Link
                href="/login"
                aria-label="Sign in"
                className="hidden size-11 items-center justify-center rounded-control text-navy transition-colors hover:bg-porcelain sm:flex"
              >
                <User strokeWidth={1.5} className="size-5" />
              </Link>
            )}

            <IconButton
              label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
              onClick={openCart}
              badge={count}
              data-cart-icon=""
              aria-haspopup="dialog"
            >
              <ShoppingBag strokeWidth={1.5} />
            </IconButton>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen} side="left" title="Menu" className="mobile-menu" bodyClassName="px-0 py-0">
        {mobileMounted && (
          <>
            <button
              type="button"
              onClick={() => {
                closeMobile()
                openSearch()
              }}
              className="mm-item mx-5 mt-2 flex min-h-12 w-[calc(100%-2.5rem)] items-center gap-3 border border-navy/15 px-4 text-sm text-muted-foreground"
              style={{ "--i": 0 } as CSSProperties}
            >
              <Search aria-hidden className="size-4" />
              Search products and brands
            </button>
            <div className="grid grid-cols-2 gap-3 px-5 pt-4">
              {[MEGA_FEATURES[0], MEGA_FEATURES[3]].map((f, i) => (
                <Link
                  key={f.href}
                  href={f.href}
                  prefetch={false}
                  onClick={closeMobile}
                  className="mm-item group relative block aspect-[4/5] overflow-hidden bg-porcelain"
                  style={{ "--i": i + 1 } as CSSProperties}
                >
                  <Image src={f.image} alt="" fill sizes="45vw" className="object-cover transition-[scale] duration-700 ease-atelier group-active:scale-105" />
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-navy-deep/85 to-transparent" />
                  <span className="absolute inset-x-3 bottom-3 text-on-dark">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-blush">{f.eyebrow}</span>
                    <span className="block font-serif text-xl leading-tight">{f.label}</span>
                  </span>
                </Link>
              ))}
            </div>
            <nav aria-label="Mobile" className="px-5 pt-4">
              {sections.map((section, i) => (
                <div key={section.label} className="mm-item" style={{ "--i": i + 1 } as CSSProperties}>
                  <Disclosure
                    summary={
                      <span className="flex items-baseline gap-3">
                        <span aria-hidden className="font-sans text-[11px] font-semibold tracking-[0.2em] text-rose">0{i + 1}</span>
                        {section.label}
                      </span>
                    }
                    name="mobile-nav"
                    className="border-navy/10"
                    summaryClassName="min-h-14 font-serif text-[1.65rem] font-normal normal-case tracking-normal text-navy-deep"
                  >
                    <ul className="grid grid-cols-2 gap-x-4">
                      {/* prefetch off: long menu list (Vercel CPU budget). */}
                      {section.items.map(sub => (
                        <li key={sub.href}>
                          <Link href={sub.href} prefetch={false} onClick={closeMobile} className="flex min-h-11 items-center text-[15px] text-foreground/85">
                            {sub.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Disclosure>
                </div>
              ))}
              {SKIN_NEEDS.map((group, i) => (
                <div key={group.label} className="mm-item" style={{ "--i": sections.length + i + 1 } as CSSProperties}>
                  <Disclosure
                    summary={`Shop ${group.label.toLowerCase()}`}
                    name="mobile-nav"
                    className="border-navy/10"
                    summaryClassName="min-h-14 font-serif text-2xl font-normal normal-case tracking-normal text-navy-deep"
                  >
                    <ul className="max-h-64 overflow-y-auto">
                      {/* prefetch off: concern/ingredient lists are long (Vercel CPU budget). */}
                      {group.items.map(item => (
                        <li key={item.href}>
                          <Link href={item.href} prefetch={false} onClick={closeMobile} className="flex min-h-11 items-center text-[15px] text-foreground/85">
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Disclosure>
                </div>
              ))}
              <ul className="grid grid-cols-2 gap-x-4 py-4">
                {[...DIRECT_LINKS, ...EXPLORE].map((link, i) => (
                  <li key={link.href} className="mm-item" style={{ "--i": sections.length + SKIN_NEEDS.length + i + 1 } as CSSProperties}>
                    <Link
                      href={link.href}
                      prefetch={false}
                      onClick={closeMobile}
                      className={cn(
                        "flex min-h-12 items-center text-xs font-medium uppercase tracking-[0.16em]",
                        "accent" in link && link.accent ? "text-rose" : "text-foreground",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            {/* Account and help: a navy block, each row a full-width target */}
            <div className="mm-item mt-2 bg-navy-deep px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-on-dark" style={{ "--i": sections.length + SKIN_NEEDS.length + 10 } as CSSProperties}>
              {session ? (
                <div className="flex items-center gap-3 border-b border-on-dark/15 py-4">
                  <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-blush font-serif text-lg text-navy-deep">
                    {session.firstName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-serif text-xl">Hello, {session.firstName}</p>
                    <p className="truncate text-xs text-on-dark/80">{session.email}</p>
                  </div>
                </div>
              ) : null}
              <ul>
                <li>
                  <Link href={session ? "/account" : "/login"} prefetch={false} onClick={closeMobile} className="flex min-h-14 items-center gap-4 border-b border-on-dark/15 text-[15px] text-on-dark">
                    <User aria-hidden className="size-5 text-blush" strokeWidth={1.5} />
                    <span className="flex-1">{session ? "My account" : "Sign in or create an account"}</span>
                    <ChevronRight aria-hidden className="size-4 text-on-dark/70" />
                  </Link>
                </li>
                <li>
                  <Link href="/account/orders" prefetch={false} onClick={closeMobile} className="flex min-h-14 items-center gap-4 border-b border-on-dark/15 text-[15px] text-on-dark">
                    <Package aria-hidden className="size-5 text-blush" strokeWidth={1.5} />
                    <span className="flex-1">Track my order</span>
                    <ChevronRight aria-hidden className="size-4 text-on-dark/70" />
                  </Link>
                </li>
                <li>
                  <a href={whatsAppHref()} target="_blank" rel="noopener noreferrer" className="flex min-h-14 items-center gap-4 border-b border-on-dark/15 text-[15px] text-on-dark">
                    <MessageCircle aria-hidden className="size-5 text-blush" strokeWidth={1.5} />
                    <span className="flex-1">Chat with us on WhatsApp</span>
                    <ArrowUpRight aria-hidden className="size-4 text-on-dark/70" />
                  </a>
                </li>
                {session ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        signOut()
                        closeMobile()
                      }}
                      className="flex min-h-14 w-full items-center gap-4 text-[15px] text-on-dark/85"
                    >
                      <LogOut aria-hidden className="size-5" strokeWidth={1.5} /> Sign out
                    </button>
                  </li>
                ) : null}
              </ul>
              <p className="mt-6 font-serif text-lg italic text-blush">Trusted brands. Authentic products.</p>
            </div>
          </>
        )}
      </Sheet>
    </>
  )
}
