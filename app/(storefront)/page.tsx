import type { CSSProperties } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
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
import { ALL_CONCERNS, slugifyCatalogLabel } from "@/lib/catalog"
import { getEffectivePrice, hasDiscount, type Product } from "@/lib/products"
import { getSiteUrl } from "@/lib/site"
import { SOCIAL_URLS } from "@/lib/storefront-copy"
import { getWhatsAppDisplay } from "@/lib/whatsapp"

/** 1h ISR; admin saves refresh it on demand (app/actions/revalidate.ts). Short windows burn Vercel CPU. */
export const revalidate = 3600
// No <Suspense> around sections: this page is served whole from the cache, and streamed
// boundaries would leave visitors without JavaScript looking at skeletons.

/** Pre-redesign category tiles (commit 9ea0dd0): same order, labels, links and images. */
const COLLECTIONS = [
  { label: "Sunscreen", href: "/shop?category=sunscreens", image: "/sunscreen.jpeg" },
  { label: "Face Toners", href: "/shop?category=face-toners-mists", image: "/toner.jpeg" },
  { label: "Body Moisturizer", href: "/shop?category=body-moisturizers-oils", image: "/moisturizer.jpeg" },
  { label: "Serum", href: "/shop?category=serums-treatment", image: "/serum.jpeg" },
]

/** The six concerns the home page has featured since the redesign, each to its concern page. */
const HOME_CONCERNS = ["Acne", "Dark Spots", "Dryness", "Excess Oil", "Fine Lines", "Sensitivity"].map(label => ({
  label,
  href: `/concern/${slugifyCatalogLabel(label)}`,
}))

const SECTION = "mx-auto max-w-7xl px-5 py-[clamp(4rem,2.5rem+5vw,8rem)] lg:px-8"

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

/* ─── Stats row: real numbers, one row of three at every width ───────────── */
async function StatsBand() {
  const [brands, productCount] = await Promise.all([getActiveBrands(), countProducts()])
  // Real numbers only. Product count shows once the range is big enough to say something.
  const stats = [
    { value: brands.length, prefix: "", label: "brands on our shelves", short: "brands on our shelves", show: brands.length > 0 },
    { value: productCount, prefix: "", label: "products ready to ship", short: "products ready to ship", show: productCount >= 50 },
    { value: ALL_CONCERNS.length, prefix: "", label: "skin concerns, mapped to products", short: "skin concerns to shop by", show: true },
    { value: 100, prefix: "₦", label: "spent earns 1 HAYDA Rewards point", short: "spent earns 1 point", show: true },
  ]
    .filter(s => s.show)
    .slice(0, 3)

  return (
    <section className="border-t border-navy/10 bg-porcelain" aria-label="HAYDA SKINCo. in numbers">
      {/* Three compact columns at every width (320px included); labels may wrap to two lines. */}
      <dl className="stats-row mx-auto grid max-w-7xl grid-cols-3 divide-x divide-navy/10 px-3 sm:px-5 lg:px-8">
        {stats.map(stat => (
          <div key={stat.label} className="flex min-w-0 flex-col-reverse justify-end gap-1.5 px-2 py-6 sm:gap-1 sm:px-8 sm:py-8 sm:first:pl-0">
            {/* Phones get a compact label (two lines at 320px); the full one from 640px. */}
            <dt className="text-[10.5px] leading-snug text-muted-foreground sm:text-sm">
              <span className="sm:hidden">{stat.short}</span>
              <span className="hidden sm:inline">{stat.label}</span>
            </dt>
            <dd className="font-serif text-[clamp(1.6rem,1rem+3vw,3.5rem)] leading-none tracking-[-0.01em] text-navy-deep tabular-nums">
              {stat.prefix && <span className="currency">{stat.prefix}</span>}
              <CountUp value={stat.value} />
            </dd>
          </div>
        ))}
      </dl>
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

/* ─── Shop by Category: the pre-redesign section (commit 9ea0dd0), markup unchanged ─── */
function CategorySection() {
  return (
    <AtelierReveal>
      <section className="mx-auto max-w-7xl px-5 py-12 md:py-20 lg:px-8" aria-labelledby="categories-title">
        <div className="mb-10 flex items-center gap-6 md:mb-14">
          <h2 id="categories-title" className="shrink-0 font-serif text-3xl font-medium tracking-tight md:text-4xl">
            Shop by Category
          </h2>
          <span className="hidden h-px flex-1 bg-border sm:block" aria-hidden />
          <Link
            href="/shop"
            className="hidden shrink-0 items-center gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-gold sm:flex"
          >
            All Products <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4 md:gap-6">
          {COLLECTIONS.map(cat => (
            <Link
              key={cat.label}
              href={cat.href}
              className="group relative block aspect-3/4 overflow-hidden border border-border bg-secondary"
            >
              <Image
                src={cat.image}
                alt={cat.label}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              <span className="absolute inset-x-3 bottom-3 border border-border bg-background/95 px-2 py-2 text-center text-[10px] font-medium uppercase leading-snug tracking-[0.14em] text-foreground md:text-[11px]">
                {cat.label}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 border border-border px-8 py-3 text-xs font-medium uppercase tracking-[0.15em] transition-colors hover:border-foreground"
          >
            All Products <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>
    </AtelierReveal>
  )
}

/* ─── Skin concerns: the pre-redesign "What's your skin type?" block (9ea0dd0), same markup,
   carrying the concerns. 9ea0dd0 had no concerns section of its own; this is its counterpart. ─── */
function ConcernSection() {
  return (
    <AtelierReveal>
      <section className="bg-secondary py-8 md:py-16" aria-labelledby="concerns-title">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-8 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-gold">Personalised for you</p>
            <h2 id="concerns-title" className="mt-1.5 font-serif text-xl md:text-3xl font-medium">What&rsquo;s your skin concern?</h2>
            <p className="mt-2 text-sm font-light text-muted-foreground">We&rsquo;ll guide you to the right products.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {HOME_CONCERNS.map(c => (
              <Link
                key={c.label}
                href={c.href}
                prefetch={false}
                className="group flex flex-col items-center gap-2 border border-border bg-background p-3 text-center transition-colors hover:bg-secondary md:p-5"
              >
                <p className="text-xs font-medium group-hover:underline underline-offset-2 md:text-sm">{c.label}</p>
                <ArrowRight className="size-3 text-muted-foreground transition-colors group-hover:text-foreground" />
              </Link>
            ))}
          </div>
          <p className="mt-6 text-center">
            <Link
              href="/shop?filter=concerns"
              prefetch={false}
              className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-gold"
            >
              All Concerns <ArrowRight className="size-3.5" />
            </Link>
          </p>
        </div>
      </section>
    </AtelierReveal>
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

/* ─── Ritual: four step cards. A swipe row on phones (the next card peeks), a grid on desktop.
   No pinning and no scroll-linked stepping: the page visibly continues past it. ─────────── */
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
    <section className="ritual bg-navy-deep text-on-dark" aria-labelledby="ritual-title">
      <div className="mx-auto max-w-7xl py-10 md:py-16">
        <div className="flex items-end justify-between gap-6 px-5 lg:px-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-blush">The ritual</p>
            <h2 id="ritual-title" className="mt-2 max-w-[18ch] font-serif text-[clamp(1.6rem,1.2rem+1.6vw,2.75rem)] font-normal leading-[1.08] md:mt-3">
              Four steps to skin that behaves
            </h2>
          </div>
          <p aria-hidden className="shrink-0 text-[11px] font-medium uppercase tracking-[0.18em] text-on-dark/70 md:hidden">
            Swipe →
          </p>
        </div>
        <ol className="ritual-row mt-6 md:mt-10" aria-label="The four steps">
          {steps.map((s, k) => {
            const price = getEffectivePrice(s.product)
            return (
              <li key={s.step} className="ritual-card">
                <article className="flex h-full flex-col bg-white text-navy-deep shadow-float">
                  <Link href={`/product/${s.product.id}`} prefetch={false} className="group block p-2 pb-0">
                    <span className="product-stage relative block aspect-5/4 overflow-hidden md:aspect-square">
                      <Image src={s.product.image || "/placeholder.svg"} alt="" fill sizes="(max-width: 768px) 72vw, 22vw" className="object-cover" />
                      <span aria-hidden className="absolute left-2 top-1.5 font-serif text-3xl leading-none text-navy-deep/25 md:text-4xl">
                        0{k + 1}
                      </span>
                    </span>
                    <span className="flex items-end justify-between gap-3 px-1 pt-2.5">
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-rose">{s.product.brand}</span>
                        <span className="mt-0.5 block truncate font-serif text-lg">{s.product.name}</span>
                      </span>
                      <Price amount={price} compareAt={hasDiscount(s.product) ? s.product.price : null} size="sm" className="shrink-0 font-serif text-base" />
                    </span>
                  </Link>
                  <div className="mt-auto px-3 pb-3 pt-2">
                    <h3 className="font-serif text-2xl font-normal italic leading-none">
                      <span className="sr-only">Step {k + 1}: </span>
                      {s.step}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-muted-foreground">{s.line}</p>
                    <Link href={s.href} prefetch={false} className="mt-2.5 inline-flex min-h-8 items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-navy">
                      <span className="link-wipe pb-0.5">Shop {s.step.toLowerCase()}</span> <ArrowRight aria-hidden className="size-3.5" />
                    </Link>
                  </div>
                </article>
              </li>
            )
          })}
        </ol>
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

/* ─── Journal feature ──────────────────────────────────────────────────────
   It used to render nothing when no article was published, which is why it vanished from the
   live site (its database has no published journals). It now always shows: the articles when
   there are some, otherwise a short "coming soon" note linking to the Journal. */
async function JournalFeature() {
  const journals = await getPublishedJournals()
  const [lead, ...rest] = journals.slice(0, 3)
  if (!lead) {
    return (
      <section className="bg-porcelain" aria-labelledby="journal-title">
        <div className="mx-auto max-w-7xl px-5 py-[clamp(3rem,2rem+3vw,5rem)] lg:px-8">
          <SectionHeading
            eyebrow="Knowledge & rituals"
            title={<span id="journal-title">From the Journal</span>}
            description="Skincare guides and routines from our team are coming soon."
            action={<ViewAll href="/journal" label="Visit the Journal" />}
          />
        </div>
      </section>
    )
  }

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

function OrganizationJsonLd() {
  const siteUrl = getSiteUrl()
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "OnlineStore",
        "@id": `${siteUrl}/#organization`,
        name: "HAYDA SKINCo.",
        url: siteUrl,
        logo: `${siteUrl}/icon-512.png`,
        image: `${siteUrl}/seo.png`,
        description:
          "Nigeria's hub for premium skincare. Authentic products from trusted brands, delivered nationwide.",
        email: "hello@haydaskinco.com",
        telephone: getWhatsAppDisplay(),
        address: {
          "@type": "PostalAddress",
          addressLocality: "Lagos",
          addressCountry: "NG",
        },
        sameAs: [SOCIAL_URLS.instagram],
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "HAYDA SKINCo.",
        url: siteUrl,
        publisher: { "@id": `${siteUrl}/#organization` },
      },
    ],
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  )
}

export default function HomePage() {
  return (
    <>
      <OrganizationJsonLd />
      <HomeHeroSlider />
      <CategorySection />
      <ConcernSection />
      <BestsellersRail />
      <RitualSection />
      <SaleSection />
      <JournalFeature />
      <StatsBand />
      <BrandMarquee />
      <RewardsBand />
    </>
  )
}
