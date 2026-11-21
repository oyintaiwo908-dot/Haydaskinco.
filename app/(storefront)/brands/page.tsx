import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import {
  getBrandStorefrontSummaries,
  type BrandStorefrontSummary,
} from "@/lib/supabase/products"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Brands — HAYDA SKINCo.",
  description:
    "Shop all brands stocked by HAYDA SKINCo. — CeraVe, The Ordinary, La Roche-Posay, COSRX, Paula's Choice, and more.",
}

/** 1h ISR; admin saves refresh it on demand (app/actions/revalidate.ts). Short windows burn Vercel CPU. */
export const revalidate = 3600

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

function groupByLetter(brands: BrandStorefrontSummary[]) {
  const groups = new Map<string, BrandStorefrontSummary[]>()

  for (const brand of brands) {
    const raw = brand.name.trim().charAt(0).toUpperCase()
    const letter = /[A-Z]/.test(raw) ? raw : "#"
    const list = groups.get(letter) ?? []
    list.push(brand)
    groups.set(letter, list)
  }

  return [...groups.entries()].sort(([a], [b]) => {
    if (a === "#") return 1
    if (b === "#") return -1
    return a.localeCompare(b)
  })
}

export default async function BrandsPage() {
  const brandsWithStock = await getBrandStorefrontSummaries()
  const grouped = groupByLetter(brandsWithStock)
  const activeLetters = new Set(grouped.map(([letter]) => letter))

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Brands We Stock"
        description="An A–Z of premium skincare brands, curated for Nigerian skin and climate. Every product is authentic and sourced from authorised distributors."
      />

      {brandsWithStock.length === 0 ? (
        <div className="mx-auto max-w-7xl px-5 py-20 text-center lg:px-8">
          <p className="font-serif text-2xl font-medium">Products are being listed</p>
          <p className="mt-2 text-sm font-light text-muted-foreground">
            Browse the shop while we refresh brand pages.
          </p>
          <Link
            href="/shop"
            className="mt-6 inline-flex items-center gap-2 border border-border px-8 py-3 text-xs font-medium uppercase tracking-[0.15em] hover:border-foreground"
          >
            Shop all products <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="relative">
          {/* A–Z jump strip */}
          <nav
            aria-label="Jump to letter"
            className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md"
          >
            <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-5 py-3 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="mr-2 shrink-0 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                A–Z
              </span>
              {ALPHABET.map(letter => {
                const active = activeLetters.has(letter)
                return active ? (
                  <a
                    key={letter}
                    href={`#letter-${letter}`}
                    className="flex size-8 shrink-0 items-center justify-center text-xs font-medium text-foreground transition-colors hover:bg-lavender hover:text-gold"
                  >
                    {letter}
                  </a>
                ) : (
                  <span
                    key={letter}
                    aria-disabled="true"
                    className="flex size-8 shrink-0 items-center justify-center text-xs font-light text-muted-foreground/35"
                  >
                    {letter}
                  </span>
                )
              })}
              {activeLetters.has("#") && (
                <a
                  href="#letter-other"
                  className="flex size-8 shrink-0 items-center justify-center text-xs font-medium text-foreground transition-colors hover:bg-lavender hover:text-gold"
                >
                  #
                </a>
              )}
            </div>
          </nav>

          <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
            <p className="mb-12 text-sm font-light text-muted-foreground">
              <span className="font-medium text-foreground">{brandsWithStock.length}</span>{" "}
              brand{brandsWithStock.length !== 1 ? "s" : ""} in stock
            </p>

            <div className="space-y-16 md:space-y-20">
              {grouped.map(([letter, brands]) => (
                <section
                  key={letter}
                  id={letter === "#" ? "letter-other" : `letter-${letter}`}
                  className="scroll-mt-24"
                >
                  <div className="grid gap-8 md:grid-cols-[7rem_1fr] md:gap-12 lg:grid-cols-[9rem_1fr]">
                    <div className="md:sticky md:top-28 md:self-start">
                      <p
                        aria-hidden
                        className="font-serif text-7xl font-medium leading-none text-gold/25 md:text-8xl lg:text-9xl"
                      >
                        {letter}
                      </p>
                      <h2 className="sr-only">Brands starting with {letter}</h2>
                    </div>

                    <ul className="divide-y divide-border border-t border-border">
                      {brands.map(brand => (
                        <li key={brand.id} id={brand.id}>
                          <Link
                            href={`/shop?brand=${encodeURIComponent(brand.name)}`}
                            className="group flex flex-col gap-2 py-6 transition-colors sm:flex-row sm:items-baseline sm:justify-between sm:gap-8 sm:py-7"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <span className="font-serif text-2xl font-medium tracking-tight text-foreground transition-colors group-hover:text-gold md:text-3xl">
                                  {brand.name}
                                </span>
                                <span className="text-[10px] font-light uppercase tracking-[0.18em] text-muted-foreground">
                                  {brand.productCount} product{brand.productCount !== 1 ? "s" : ""}
                                </span>
                              </div>
                              {brand.tagline && (
                                <p className="mt-1.5 max-w-xl text-sm font-light leading-relaxed text-muted-foreground">
                                  {brand.tagline}
                                </p>
                              )}
                              {brand.sampleNames.length > 0 && (
                                <p className="mt-2 text-xs font-light text-muted-foreground/80">
                                  {brand.sampleNames.join(" · ")}
                                </p>
                              )}
                            </div>
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.15em]",
                                "text-gold opacity-80 transition-all group-hover:opacity-100 group-hover:translate-x-0.5",
                              )}
                            >
                              Shop <ArrowRight className="size-3.5" />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="border-t border-border bg-secondary">
        <div className="mx-auto max-w-7xl px-5 py-16 text-center lg:px-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-gold mb-2">For businesses</p>
          <h3 className="font-serif text-2xl font-medium mb-2 md:text-3xl">Interested in wholesale?</h3>
          <p className="mx-auto mb-6 max-w-md text-sm font-light text-muted-foreground">
            We supply salons, spas, clinics, and retailers across Nigeria with authentic skincare brands at wholesale prices.
          </p>
          <Link
            href="/wholesale"
            className="inline-flex items-center gap-2 bg-foreground px-8 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-background transition-colors hover:bg-gold hover:text-gold-foreground"
          >
            Learn More <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>
    </>
  )
}
