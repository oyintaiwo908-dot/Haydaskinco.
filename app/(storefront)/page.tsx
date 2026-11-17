import Image from "next/image"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowRight, Sparkles } from "lucide-react"
import { AtelierReveal } from "@/components/atelier-reveal"
import { HomeHeroSlider } from "@/components/home-hero-slider"
import { ProductCard } from "@/components/product-card"
import { getProductsByTag, getDiscountedProducts } from "@/lib/supabase/products"
import { getActiveBrands } from "@/lib/supabase/brands"
import { dealAsProduct } from "@/lib/deals"
import { getActiveDeals } from "@/lib/supabase/deals"
import { getPublishedJournals } from "@/lib/supabase/journals"
import { ALL_SKIN_TYPES, slugifyCatalogLabel } from "@/lib/catalog"
import { getSiteUrl } from "@/lib/site"
import { SOCIAL_URLS } from "@/lib/storefront-copy"
import { getWhatsAppDisplay } from "@/lib/whatsapp"

export const revalidate = 60

const COLLECTIONS = [
  {
    label: "Sunscreen",
    href: "/shop?category=sunscreens",
    image: "/sunscreen.jpeg",
  },
  {
    label: "Face Toners",
    href: "/shop?category=face-toners-mists",
    image: "/toner.jpeg",
  },
  {
    label: "Body Moisturizer",
    href: "/shop?category=body-moisturizers-oils",
    image: "/moisturizer.jpeg",
  },
  {
    label: "Serum",
    href: "/shop?category=serums-treatment",
    image: "/serum.jpeg",
  },
]

const SKIN_TYPES = ALL_SKIN_TYPES.map(label => ({
  label,
  href: `/shop?skinType=${slugifyCatalogLabel(label)}`,
}))

function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="aspect-4/5 animate-pulse bg-muted/40" />
          <div className="mx-auto h-3 w-2/3 animate-pulse bg-muted/40" />
          <div className="mx-auto h-3 w-1/3 animate-pulse bg-muted/30" />
        </div>
      ))}
    </div>
  )
}

async function BestsellersSection() {
  const bestsellers = await getProductsByTag("Bestseller", 4)
  return (
    <AtelierReveal>
    <section className="mx-auto max-w-7xl px-5 py-8 md:py-16 lg:px-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-gold">Customer favourites</p>
          <h2 className="mt-1.5 font-serif text-xl md:text-3xl font-medium">Best Sellers</h2>
        </div>
        <Link href="/shop" className="hidden items-center gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground hover:text-gold transition-colors sm:flex">
          View All <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
        {bestsellers.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} />
        ))}
      </div>
      {bestsellers.length === 0 && (
        <p className="text-center text-sm font-light text-muted-foreground">Bestsellers are on the way.</p>
      )}
      <div className="mt-8 text-center sm:hidden">
        <Link href="/shop" className="inline-flex items-center gap-2 border border-border px-8 py-3 text-xs font-medium uppercase tracking-[0.15em] hover:border-foreground transition-colors">
          View All Products <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
    </AtelierReveal>
  )
}

async function FeaturedSection() {
  const featuredNew = await getProductsByTag("New", 4)
  return (
    <AtelierReveal>
    <section className="mx-auto max-w-7xl px-5 py-8 md:py-16 lg:px-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-gold">Just dropped</p>
          <h2 className="mt-1.5 font-serif text-xl md:text-3xl font-medium">Featured Products</h2>
        </div>
        <Link href="/shop" className="hidden items-center gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground hover:text-gold transition-colors sm:flex">
          View All <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-3 md:gap-x-5 gap-y-6 md:gap-y-10 md:grid-cols-4">
        {featuredNew.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} />
        ))}
      </div>
      {featuredNew.length === 0 && (
        <p className="text-center text-sm font-light text-muted-foreground">New products are on the way.</p>
      )}
      <div className="mt-8 text-center sm:hidden">
        <Link href="/shop" className="inline-flex items-center gap-2 border border-border px-6 md:px-8 py-3 text-xs font-medium uppercase tracking-[0.15em] hover:border-foreground transition-colors">
          View All Products <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
    </AtelierReveal>
  )
}

async function JournalSection() {
  const journals = await getPublishedJournals()
  const recentArticles = journals.slice(0, 3)
  if (!recentArticles.length) return null

  return (
    <AtelierReveal>
    <section className="mx-auto max-w-7xl px-5 py-8 md:py-16 lg:px-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-gold">Knowledge & Rituals</p>
          <h2 className="mt-1.5 font-serif text-xl md:text-3xl font-medium">From the Skin Blog</h2>
        </div>
        <Link href="/journal" className="hidden items-center gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground hover:text-gold transition-colors sm:flex">
          All Articles <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="grid gap-7 md:grid-cols-3">
        {recentArticles.map(article => (
          <Link key={article.id} href={`/journal/${article.slug}`} className="group">
            <div className="relative aspect-[4/3] w-full overflow-hidden border border-border bg-muted group-hover:border-gold/60 transition-colors">
              <Image
                src={article.image || "/placeholder.svg"}
                alt={article.title}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            </div>
            <div className="pt-4">
              <div className="flex items-center gap-3 text-[10px] font-light uppercase tracking-[0.18em]">
                <span className="text-gold">{article.category}</span>
                <span className="text-muted-foreground">{article.readTime} min read</span>
              </div>
              <h3 className="mt-2 font-serif text-xl font-medium leading-snug group-hover:text-gold transition-colors">
                {article.title}
              </h3>
              <p className="mt-1.5 text-sm font-light text-muted-foreground line-clamp-2">{article.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
    </AtelierReveal>
  )
}

async function SaleSection() {
  const [saleProducts, deals] = await Promise.all([
    getDiscountedProducts({ limit: 4 }),
    getActiveDeals(),
  ])
  const saleDeals = deals.slice(0, 3)
  if (!saleProducts.length && !saleDeals.length) return null

  return (
    <AtelierReveal>
    <section className="bg-secondary py-8 md:py-16">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-gold">Limited time</p>
            <h2 className="mt-1.5 font-serif text-xl md:text-3xl font-medium">On Sale</h2>
            <p className="mt-1 text-sm font-light text-muted-foreground">
              Discounted favourites and curated combo deals.
            </p>
          </div>
          <div className="hidden items-center gap-4 sm:flex">
            <Link href="/offers" className="items-center gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground hover:text-gold transition-colors flex">
              Offers <ArrowRight className="size-3.5" />
            </Link>
            <Link href="/deals" className="items-center gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground hover:text-gold transition-colors flex">
              Deals <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
          {saleProducts.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} isWhiteBackground />
          ))}
          {saleDeals.map((deal, i) => (
            <ProductCard
              key={deal.id}
              product={dealAsProduct(deal)}
              index={saleProducts.length + i}
              isWhiteBackground
              href={`/deal/${deal.id}`}
            />
          ))}
        </div>

        <div className="mt-8 flex justify-center gap-3 sm:hidden">
          <Link href="/offers" className="inline-flex items-center gap-2 border border-border bg-background px-6 md:px-8 py-3 text-xs font-medium uppercase tracking-[0.15em] hover:border-foreground transition-colors">
            Offers <ArrowRight className="size-2.5 md:size-3.5" />
          </Link>
          <Link href="/deals" className="inline-flex items-center gap-2 border border-border bg-background px-6 md:px-8 py-3 text-xs font-medium uppercase tracking-[0.15em] hover:border-foreground transition-colors">
            Deals <ArrowRight className="size-2.5 md:size-3.5" />
          </Link>
        </div>
      </div>
    </section>
    </AtelierReveal>
  )
}

async function BrandsSection() {
  const brands = await getActiveBrands()
  return (
    <AtelierReveal>
    <section className="border-y border-border bg-background py-14 md:py-16">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-gold">Shop by brand</p>
            <h2 className="mt-1.5 font-serif text-xl font-medium md:text-3xl">Trusted brands</h2>
          </div>
          <Link href="/brands" className="shrink-0 text-xs font-medium uppercase tracking-[0.15em] text-gold hover:underline underline-offset-2">
            View all
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brands.slice(0, 6).map(brand => (
            <Link
              key={brand.id}
              href={`/shop?brand=${encodeURIComponent(brand.name)}`}
              className="group flex items-center justify-between gap-4 border border-border bg-background px-5 py-5 transition-colors hover:border-gold/40 hover:bg-secondary"
            >
              <span className="font-serif text-lg font-medium tracking-tight text-foreground md:text-xl">
                {brand.name}
              </span>
              <ArrowRight className="size-4 shrink-0 text-gold transition-transform duration-700 ease-[cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>
    </section>
    </AtelierReveal>
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

      <AtelierReveal>
      <section className="mx-auto max-w-7xl px-5 py-12 md:py-20 lg:px-8">
        <div className="mb-10 flex items-center gap-6 md:mb-14">
          <h2 className="shrink-0 font-serif text-3xl font-medium tracking-tight md:text-4xl">
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

      <Suspense fallback={
        <div className="mx-auto max-w-7xl px-5 py-8 md:py-16 lg:px-8">
          <ProductGridSkeleton />
        </div>
      }>
        <BestsellersSection />
      </Suspense>

      <AtelierReveal>
      <section className="bg-secondary py-8 md:py-16">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-8 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-gold">Personalised for you</p>
            <h2 className="mt-1.5 font-serif text-xl md:text-3xl font-medium">What&rsquo;s your skin type?</h2>
            <p className="mt-2 text-sm font-light text-muted-foreground">We&rsquo;ll guide you to the right products.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {SKIN_TYPES.map(c => (
              <Link
                key={c.label}
                href={c.href}
                className="group flex flex-col items-center gap-2 border border-border bg-background p-3 text-center transition-colors hover:bg-secondary md:p-5"
              >
                <p className="text-xs font-medium group-hover:underline underline-offset-2 md:text-sm">{c.label}</p>
                <ArrowRight className="size-3 text-muted-foreground transition-colors group-hover:text-foreground" />
              </Link>
            ))}
          </div>
        </div>
      </section>
      </AtelierReveal>

      <Suspense fallback={
        <div className="mx-auto max-w-7xl px-5 py-8 md:py-16 lg:px-8">
          <ProductGridSkeleton />
        </div>
      }>
        <FeaturedSection />
      </Suspense>

      <Suspense fallback={null}>
        <JournalSection />
      </Suspense>

      <Suspense fallback={
        <div className="bg-secondary py-8 md:py-16">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <ProductGridSkeleton />
          </div>
        </div>
      }>
        <SaleSection />
      </Suspense>

      <Suspense fallback={null}>
        <BrandsSection />
      </Suspense>

      <AtelierReveal>
      <section className="bg-foreground py-8 md:py-16">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left md:justify-between">
            <div>
              <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                <Sparkles className="size-4 text-gold" />
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-gold">Rewards Programme</span>
              </div>
              <h2 className="font-serif text-xl md:text-3xl font-medium text-background">Earn points with every purchase</h2>
              <p className="mt-2 text-sm font-light text-background/60 max-w-md">
                Join HAYDA Rewards and earn 1 point for every ₦100 spent. Redeem points for discounts, free products, and exclusive member perks.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row shrink-0">
              <Link href="/register" className="flex items-center gap-2 bg-gold px-8 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-gold-foreground transition-all hover:bg-gold/90">
                Join Free <ArrowRight className="size-3.5" />
              </Link>
              <Link href="/login" className="flex items-center gap-2 border border-background/30 px-8 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-background transition-all hover:border-background/60">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>
      </AtelierReveal>
    </>
  )
}
