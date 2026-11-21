import type { CSSProperties } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ArrowUpRight, Sparkles } from "lucide-react"
import { AtelierReveal } from "@/components/atelier-reveal"
import { DragRail } from "@/components/drag-rail"
import { HomeHeroSlider } from "@/components/home-hero-slider"
import { Magnetic } from "@/components/motion/magnetic"
import { CountUp } from "@/components/motion/count-up"
import { ProductCard } from "@/components/product-card"
import { SectionHeading } from "@/components/ui/section-heading"
import { buttonVariants } from "@/components/ui/button"
import { Money, Price } from "@/components/ui/price"
import { countProducts, getProductsByTag, getDiscountedProducts, queryProducts } from "@/lib/supabase/products"
import { getActiveBrands } from "@/lib/supabase/brands"
import { dealAsProduct } from "@/lib/deals"
import { getActiveDeals } from "@/lib/supabase/deals"
import { getPublishedJournals } from "@/lib/supabase/journals"
import { ALL_CONCERNS, ALL_SKIN_TYPES, slugifyCatalogLabel } from "@/lib/catalog"
import { getEffectivePrice, hasDiscount, type Product } from "@/lib/products"
import { FREE_STANDARD_DELIVERY } from "@/lib/storefront-copy"

/** 1h ISR; admin saves refresh it on demand (app/actions/revalidate.ts). Short windows burn Vercel CPU. */
export const revalidate = 3600
// No <Suspense> around sections: this page is served whole from the cache, and streamed
// boundaries would leave visitors without JavaScript looking at skeletons.

const COLLECTIONS = [
  { label: "Sunscreen", note: "Protect", href: "/shop?category=sunscreens", image: "/sunscreen.jpeg" },
  { label: "Serums", note: "Treat", href: "/shop?category=serums-treatment", image: "/serum.jpeg" },
  { label: "Face toners", note: "Refresh", href: "/shop?category=face-toners-mists", image: "/toner.jpeg" },
  { label: "Body moisturiser", note: "Nourish", href: "/shop?category=body-moisturizers-oils", image: "/moisturizer.jpeg" },
]

const SKIN_TYPES = ALL_SKIN_TYPES.map(label => ({
  label,
  href: `/shop?skinType=${slugifyCatalogLabel(label)}`,
}))

const SECTION = "mx-auto max-w-7xl px-5 py-[clamp(4rem,2.5rem+5vw,8rem)] lg:px-8"

const STATEMENT =
  "Authentic skincare from brands you trust, chosen with care and delivered to your door across Nigeria."

/** The four-step routine, matched to real catalogue products by category. */
const RITUAL = [
  { step: "Cleanse", line: "Start clean. A gentle cleanser lifts the day without stripping your barrier.", match: /cleans/i, href: "/shop?category=cleansers" },
  { step: "Treat", line: "Target what matters: serums for spots, pores, glow or texture.", match: /serum|treat/i, href: "/shop?category=serums-treatment" },
  { step: "Moisturise", line: "Seal it in. Ceramides and humectants keep skin calm and supple.", match: /moistur|cream/i, href: "/shop?category=face-moisturizers" },
  { step: "Protect", line: "Every single day. Broad-spectrum SPF made for Lagos weather.", match: /sun|spf/i, href: "/shop?category=sunscreens" },
]

function ViewAll({ href, label = "View all" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-navy">
      <span className="link-wipe pb-0.5">{label}</span>
      <ArrowRight aria-hidden className="size-4 transition-transform duration-300 ease-atelier group-hover:translate-x-1" />
    </Link>
  )
}

/* ─── Statement band: oversized type, words light up on scroll ─────────────── */
async function StatementBand() {
  const [brands, productCount] = await Promise.all([getActiveBrands(), countProducts()])
  const words = STATEMENT.split(" ")
  // Real numbers only. Product count shows once the range is big enough to say something.
  const stats = [
    { value: brands.length, prefix: "", label: "brands on our shelves", show: brands.length > 0 },
    { value: productCount, prefix: "", label: "products ready to ship", show: productCount >= 50 },
    { value: ALL_CONCERNS.length, prefix: "", label: "skin concerns, mapped to products", show: true },
    { value: 100, prefix: "₦", label: "spent earns 1 HAYDA Rewards point", show: true },
  ]
    .filter(s => s.show)
    .slice(0, 3)

  return (
    <section className="relative overflow-hidden" aria-labelledby="statement-title">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-[clamp(4rem,2.5rem+5vw,7rem)] md:grid-cols-12 md:gap-10 lg:px-8">
        <div className="md:col-span-7 lg:col-span-6 lg:col-start-2">
          <p className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.24em] text-rose">
            <span aria-hidden className="h-px w-10 bg-rose" /> The HAYDA promise
          </p>
          <h2
            id="statement-title"
            className="mt-6 max-w-[19em] font-serif text-[clamp(1.75rem,1.2rem+2vw,3rem)] font-normal leading-[1.15] tracking-[-0.01em] text-navy-deep text-pretty"
          >
            {words.map((word, i) => (
              <span key={i} className="statement-word" style={{ "--w": i } as CSSProperties}>
                {i === 0 || i === 1 ? <em className="text-rose">{word}</em> : word}{" "}
              </span>
            ))}
          </h2>
        </div>
        <figure className="relative mx-auto w-full max-w-sm md:col-span-5 md:max-w-none lg:col-span-4">
          <span className="relative block aspect-[4/5] overflow-hidden bg-porcelain">
            <Image
              src="/editorial/brand-story-1000.webp"
              alt="Hands holding a frosted skincare bottle"
              fill
              sizes="(max-width: 1024px) 90vw, 30vw"
              className="parallax-img object-cover"
            />
          </span>
          <figcaption className="absolute -bottom-5 -left-3 max-w-[15rem] bg-navy-deep px-5 py-4 text-sm leading-snug text-on-dark shadow-float md:-left-10">
            <span className="block font-serif text-xl italic text-blush">Trusted brands. Authentic products.</span>
            {FREE_STANDARD_DELIVERY}.
          </figcaption>
        </figure>
      </div>
      <div className="border-y border-navy/10 bg-porcelain">
        <dl className="mx-auto grid max-w-7xl divide-y divide-navy/10 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:px-8">
          {stats.map(stat => (
            <div key={stat.label} className="flex flex-col-reverse gap-1 py-8 sm:px-8 sm:first:pl-0">
              <dt className="text-sm text-muted-foreground">{stat.label}</dt>
              <dd className="font-serif text-[clamp(2.5rem,1.9rem+2vw,3.5rem)] leading-none tracking-[-0.01em] text-navy-deep tabular-nums">
                {stat.prefix && <span className="currency">{stat.prefix}</span>}
                <CountUp value={stat.value} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

/* ─── Brand marquee ──────────────────────────────────────────────────────── */
async function BrandMarquee() {
  const brands = await getActiveBrands()
  if (!brands.length) return null
  const list = brands.slice(0, 14)
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {list.map(brand => (
        <li key={brand.id} className="flex items-center">
          <Link
            href={`/shop?brand=${encodeURIComponent(brand.name)}`}
            prefetch={false}
            tabIndex={hidden ? -1 : undefined}
            className="px-6 font-serif text-[clamp(1.6rem,1.2rem+1.6vw,2.6rem)] leading-none text-navy-deep transition-colors duration-300 hover:text-rose md:px-10"
          >
            {brand.name}
          </Link>
          <Sparkles aria-hidden className="size-5 shrink-0 text-rose" strokeWidth={1.25} />
        </li>
      ))}
    </ul>
  )
  return (
    <section className="border-y border-navy/10 bg-porcelain py-10 md:py-14" aria-label="Brands we stock">
      <div className="marquee overflow-hidden">
        <div className="marquee-track">
          {row(false)}
          {row(true)}
        </div>
      </div>
      <p className="mt-8 text-center">
        <ViewAll href="/brands" label="All brands" />
      </p>
    </section>
  )
}

/* ─── Category tiles ─────────────────────────────────────────────────────── */
function CategoryTiles() {
  return (
    <section className={SECTION} aria-labelledby="categories-title">
      <SectionHeading
        eyebrow="Explore"
        title={<span id="categories-title">Shop by category</span>}
        action={<ViewAll href="/shop" label="All products" />}
        className="mb-10"
      />
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-12 md:grid-rows-2 md:gap-5">
        {COLLECTIONS.map((cat, i) => (
          <li
            key={cat.label}
            className={
              i === 0
                ? "col-span-2 md:col-span-6 md:row-span-2"
                : i === 1
                  ? "col-span-2 md:col-span-6"
                  : "md:col-span-3"
            }
          >
            <Link href={cat.href} className="tile group relative block h-full overflow-hidden">
              <span
                className={`tile-media relative block overflow-hidden bg-porcelain ${
                  i === 0 ? "aspect-4/5 md:aspect-auto md:h-full md:min-h-[36rem]" : i === 1 ? "aspect-[16/10] md:aspect-[16/9]" : "aspect-4/5"
                }`}
              >
                <Image
                  src={cat.image}
                  alt=""
                  fill
                  sizes={i === 0 ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 50vw, 25vw"}
                  className="object-cover"
                />
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-navy-deep/80 via-navy-deep/25 to-transparent" />
                <span aria-hidden className="tile-curtain" />
              </span>
              <span className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 text-on-dark md:inset-x-6 md:bottom-6">
                <span>
                  <span className="block text-[11px] font-medium uppercase tracking-[0.22em] text-on-dark/90">{cat.note}</span>
                  <span className={`mt-1 block font-serif leading-none ${i === 0 ? "text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)]" : "text-2xl md:text-3xl"}`}>
                    {cat.label}
                  </span>
                </span>
                <span className="tile-arrow flex size-10 shrink-0 items-center justify-center rounded-full border border-on-dark/60">
                  <ArrowUpRight aria-hidden className="size-4" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-10 flex flex-wrap items-center gap-2 md:gap-3">
        <span className="mr-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">By skin type</span>
        {SKIN_TYPES.map(c => (
          <Link
            key={c.label}
            href={c.href}
            prefetch={false}
            className="inline-flex min-h-11 items-center rounded-control border border-navy/20 px-5 text-sm font-medium text-navy-deep transition-colors duration-300 hover:border-navy hover:bg-navy hover:text-primary-foreground"
          >
            {c.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

/* ─── Shop by concern: bento grid ────────────────────────────────────────── */
const CONCERN_TILES = [
  { concern: "Acne", note: "Clear and calm", image: "/editorial/journal-glow-900.webp", area: "md:col-span-2 md:row-span-2" },
  { concern: "Dark Spots", note: "Even it out", image: "/editorial/journal-ritual-900.webp", area: "md:row-span-2" },
  { concern: "Dryness", note: "Deep hydration", image: "/editorial/journal-ingredients-900.webp", area: "" },
  { concern: "Excess Oil", note: "Balance and mattify", image: "/editorial/product-toner-600.webp", area: "" },
  { concern: "Fine Lines", note: "Smooth and firm", image: "/editorial/brand-story-1000.webp", area: "md:col-span-2" },
  { concern: "Sensitivity", note: "Soothe and protect", image: "/editorial/hero-skincare-720.webp", area: "md:col-span-2" },
] as const

function ConcernBento() {
  return (
    <section className={SECTION} aria-labelledby="concerns-title">
      <SectionHeading
        eyebrow="Skin concerns"
        title={<span id="concerns-title">Shop by what your skin needs</span>}
        action={<ViewAll href="/shop?filter=concerns" label="All concerns" />}
        className="mb-10"
      />
      <ul className="grid auto-rows-[11rem] grid-cols-2 gap-3 md:auto-rows-[13.5rem] md:grid-cols-4 md:gap-4">
        {CONCERN_TILES.map((tile, i) => (
          <li key={tile.concern} className={`${i === 0 ? "col-span-2 row-span-2" : i === 5 ? "col-span-2" : ""} ${tile.area}`}>
            <Link
              href={`/concern/${slugifyCatalogLabel(tile.concern)}`}
              prefetch={false}
              className="bento group relative flex h-full overflow-hidden bg-porcelain text-on-dark"
            >
              <Image
                src={tile.image}
                alt=""
                fill
                sizes={i === 0 ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 50vw, 25vw"}
                className="bento-img object-cover"
              />
              {/* One scrim for every tile: navy at 90% under the label, so it reads (AA) on any photo. */}
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-[70%] bg-linear-to-t from-navy-deep/90 from-25% via-navy-deep/45 to-transparent" />
              <span aria-hidden className="bento-sheen" />
              <span className="relative mt-auto flex w-full items-end justify-between gap-3 p-4 md:p-6">
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-blush">{tile.note}</span>
                  <span className={`mt-1 block font-serif leading-tight ${i === 0 ? "text-[clamp(1.6rem,1.3rem+1.2vw,2.4rem)]" : "text-xl md:text-2xl"}`}>{tile.concern}</span>
                </span>
                <span className="bento-arrow flex size-9 shrink-0 items-center justify-center rounded-full border border-on-dark/60">
                  <ArrowUpRight aria-hidden className="size-4" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ─── Bestsellers: draggable snap rail ───────────────────────────────────── */
async function BestsellersRail() {
  const bestsellers = await getProductsByTag("Bestseller", 10)
  if (!bestsellers.length) return null
  return (
    <section className="overflow-hidden bg-secondary" aria-labelledby="bestsellers-title">
      <div className={SECTION}>
        <SectionHeading
          eyebrow="Customer favourites"
          title={<span id="bestsellers-title">The best sellers</span>}
          description="Drag, swipe or use the arrows. These are the products customers come back for."
          action={<ViewAll href="/shop" />}
          className="mb-10"
        />
        <DragRail label="Best sellers" itemClassName="w-[68%] sm:w-[42%] md:w-[30%] lg:w-[23%]">
          {bestsellers.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} isWhiteBackground />
          ))}
        </DragRail>
      </div>
    </section>
  )
}

/* ─── Ritual: pinned, scroll-linked steps ────────────────────────────────── */
async function RitualSection() {
  const pool = await queryProducts({ sort: "featured", limit: 60 })
  const used = new Set<string>()
  const steps = RITUAL.map(step => {
    const product = pool.find(p => !used.has(p.id) && [p.category, ...(p.categories ?? [])].some(c => step.match.test(c)))
    if (product) used.add(product.id)
    return { ...step, product }
  }).filter((s): s is typeof s & { product: Product } => Boolean(s.product))
  if (steps.length < 3) return null

  return (
    <section
      className="ritual relative bg-navy-deep text-on-dark"
      style={{ "--steps": steps.length } as CSSProperties}
      aria-labelledby="ritual-title"
    >
      <div className="ritual-pin">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 pb-10 pt-20 md:gap-10 md:py-20 lg:grid-cols-[auto_1fr] lg:gap-16 lg:px-8">
          <div className="flex gap-6 lg:flex-col lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-blush">The ritual</p>
              <h2 id="ritual-title" className="mt-3 max-w-[16ch] font-serif text-[clamp(1.6rem,1.2rem+1.6vw,2.75rem)] font-normal leading-[1.08] lg:max-w-[12ch]">
                Four steps to skin that behaves
              </h2>
            </div>
            <span aria-hidden className="relative hidden h-40 w-px bg-on-dark/20 lg:block">
              <span className="ritual-bar absolute inset-0 bg-blush" />
            </span>
          </div>
          <ol className="ritual-steps">
            {steps.map((s, k) => {
              const price = getEffectivePrice(s.product)
              return (
                <li key={s.step} className="ritual-step grid items-center gap-6 md:grid-cols-[1fr_minmax(0,24rem)] md:gap-12" style={{ "--k": k } as CSSProperties}>
                  <div>
                    <p className="hidden font-serif text-[clamp(3rem,2rem+4vw,6rem)] leading-none text-on-dark/15 sm:block" aria-hidden>
                      0{k + 1}
                    </p>
                    <h3 className="font-serif sm:-mt-4 text-[clamp(2rem,1.5rem+1.8vw,3rem)] font-normal italic leading-none md:-mt-6">
                      <span className="sr-only">Step {k + 1}: </span>
                      {s.step}
                    </h3>
                    <p className="mt-4 max-w-md text-base leading-relaxed text-on-dark/85 md:mt-5 md:text-lg">{s.line}</p>
                    <Link href={s.href} prefetch={false} className="mt-5 inline-flex md:mt-8 items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-blush">
                      <span className="link-wipe pb-0.5">Shop {s.step.toLowerCase()}</span> <ArrowRight aria-hidden className="size-4" />
                    </Link>
                  </div>
                  <Link href={`/product/${s.product.id}`} prefetch={false} className="group block w-full max-w-[12.5rem] bg-white p-2 text-navy-deep shadow-float sm:max-w-[15rem] md:max-w-none">
                    <span className="relative block aspect-4/5 overflow-hidden bg-porcelain">
                      <Image
                        src={s.product.image || "/placeholder.svg"}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 90vw, 24rem"
                        className="ritual-image object-cover"
                      />
                    </span>
                    <span className="flex items-end justify-between gap-3 px-2 pb-1 pt-3">
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-rose">{s.product.brand}</span>
                        <span className="mt-0.5 block truncate font-serif text-xl">{s.product.name}</span>
                      </span>
                      <Price
                        amount={price}
                        compareAt={hasDiscount(s.product) ? s.product.price : null}
                        size="sm"
                        className="shrink-0 font-serif text-lg"
                      />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* ─── Sale grid ──────────────────────────────────────────────────────────── */
async function SaleSection() {
  const [saleProducts, deals] = await Promise.all([getDiscountedProducts({ limit: 6 }), getActiveDeals()])
  const saleDeals = deals.slice(0, 1)
  const items = saleProducts.slice(0, saleDeals.length ? 5 : 6)
  if (!items.length && !saleDeals.length) return null

  return (
    <AtelierReveal>
      <section className={SECTION} aria-labelledby="sale-title">
        <SectionHeading
          eyebrow="Limited time"
          title={<span id="sale-title">On sale now</span>}
          description="Discounted favourites and curated combo deals."
          action={
            <div className="flex gap-6">
              <ViewAll href="/offers" label="Offers" />
              <ViewAll href="/deals" label="Deals" />
            </div>
          }
          className="mb-10"
        />
        {/* At most three across: larger frames hold up better when catalogue photos vary in quality. */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-8 md:gap-y-14">
          {items.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
          {saleDeals.map((deal, i) => (
            <ProductCard key={deal.id} product={dealAsProduct(deal)} index={items.length + i} href={`/deal/${deal.id}`} />
          ))}
        </div>
      </section>
    </AtelierReveal>
  )
}

/* ─── Journal feature ────────────────────────────────────────────────────── */
async function JournalFeature() {
  const journals = await getPublishedJournals()
  const [lead, ...rest] = journals.slice(0, 3)
  if (!lead) return null

  return (
    <section className="bg-porcelain" aria-labelledby="journal-title">
      <div className={SECTION}>
        <SectionHeading
          eyebrow="Knowledge & rituals"
          title={<span id="journal-title">From the Journal</span>}
          action={<ViewAll href="/journal" label="All articles" />}
          className="mb-10"
        />
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <Link href={`/journal/${lead.slug}`} className="group lg:col-span-7">
            <span className="relative block aspect-[4/3] overflow-hidden bg-white">
              <Image
                src={lead.image || "/placeholder.svg"}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 58vw"
                className="parallax-img object-cover"
              />
            </span>
          </Link>
          <div className="flex flex-col justify-between gap-10 lg:col-span-5">
            <Link href={`/journal/${lead.slug}`} className="group block">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-rose">
                {lead.category} <span className="text-muted-foreground">· {lead.readTime} min read</span>
              </p>
              <h3 className="mt-4 font-serif text-[clamp(1.75rem,1.35rem+1.4vw,2.5rem)] font-normal leading-[1.1] text-navy-deep">
                <span className="link-wipe">{lead.title}</span>
              </h3>
              <p className="mt-4 line-clamp-3 text-lg text-muted-foreground">{lead.excerpt}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-navy">
                Read the article <ArrowRight aria-hidden className="size-4 transition-transform duration-300 ease-atelier group-hover:translate-x-1" />
              </span>
            </Link>
            {rest.length > 0 && (
              <ul className="divide-y divide-navy/10 border-y border-navy/10">
                {rest.map(article => (
                  <li key={article.id}>
                    <Link href={`/journal/${article.slug}`} className="group grid grid-cols-[5.5rem_1fr] items-center gap-4 py-5">
                      <span className="relative block aspect-square overflow-hidden bg-white">
                        <Image src={article.image || "/placeholder.svg"} alt="" fill sizes="88px" className="object-cover transition-[scale] duration-700 ease-atelier group-hover:scale-110" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-rose">{article.category}</span>
                        <span className="mt-1 block font-serif text-xl leading-snug text-navy-deep">
                          <span className="link-wipe">{article.title}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Rewards band with moving light ─────────────────────────────────────── */
function RewardsBand() {
  return (
    <section
      className="relative isolate overflow-hidden bg-navy-deep"
      aria-labelledby="rewards-title"
      style={
        {
          "--f1": "rgb(250 203 211 / 0.45)",
          "--f2": "rgb(92 107 134 / 0.75)",
          "--f3": "rgb(232 145 158 / 0.35)",
        } as CSSProperties
      }
    >
      <div className="light-field" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="hero-grain" aria-hidden />
      <div className={`${SECTION} relative grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-end`}>
        <div>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-blush">
            <Sparkles aria-hidden className="size-4" /> HAYDA Rewards
          </p>
          <h2 id="rewards-title" className="mt-4 max-w-[16ch] font-serif text-[clamp(2rem,1.5rem+2vw,3.25rem)] font-normal leading-[1.05] text-on-dark">
            Every order <em className="text-blush">earns</em> you more
          </h2>
          <p className="mt-5 max-w-lg text-lg text-on-dark/85">
            Earn 1 point for every <Money amount={100} /> spent and redeem points for discounts on future orders.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:flex-row md:justify-end">
          <Magnetic>
            <Link href="/register" className={`${buttonVariants({ variant: "light", size: "lg" })} btn-sheen`}>
              Join free <ArrowRight aria-hidden />
            </Link>
          </Magnetic>
          <Link href="/login" className={buttonVariants({ variant: "outline-light", size: "lg" })}>
            Sign in
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <>
      <HomeHeroSlider />
      <StatementBand />
      <BrandMarquee />
      <CategoryTiles />
      <BestsellersRail />
      <ConcernBento />
      <RitualSection />
      <SaleSection />
      <JournalFeature />
      <RewardsBand />
    </>
  )
}
