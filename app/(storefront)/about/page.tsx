import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Leaf, FlaskConical, Sparkles, Heart } from "lucide-react"
import { PageHeader } from "@/components/page-header"

export const metadata: Metadata = {
  title: "Our Story — HAYDA SKINCo.",
  description:
    "Discover the story behind HAYDA SKINCo. — Nigeria's hub for premium skincare, stocking trusted brands and delivering nationwide.",
}

const values = [
  {
    icon: Leaf,
    title: "100% Authentic",
    body: "Every product is sourced directly from authorised distributors. No fakes, no grey-market imports — ever.",
  },
  {
    icon: FlaskConical,
    title: "Dermatologist-Approved",
    body: "We stock only clinically-backed, proven brands recommended by dermatologists worldwide.",
  },
  {
    icon: Sparkles,
    title: "Curated for Nigeria",
    body: "Our selection is tailored for Nigerian skin types, climate, and lifestyles — from Lagos heat to harmattan.",
  },
  {
    icon: Heart,
    title: "Delivery across Nigeria",
    body: "Order from anywhere in Nigeria. After your order, our team contacts you to arrange delivery.",
  },
]

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="Our Story"
        title="Nigeria's hub for all your skin needs"
        description="HAYDA SKINCo. was built to make premium skincare accessible — no fakes, no guesswork, just authentic products delivered to your door."
      />

      <section className="mx-auto grid max-w-7xl items-end gap-10 px-5 py-16 md:py-24 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <figure className="lg:col-span-7">
          <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[5/4] lg:aspect-[4/5]">
            <Image
              src="/brand-story.png"
              alt="HAYDA SKINCo. curated skincare products"
              fill
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover"
            />
            <span className="pointer-events-none absolute inset-3 border border-gold/40" />
          </div>
          <figcaption className="mt-4 text-xs font-light uppercase tracking-[0.3em] text-gold">
            Lagos, Nigeria
          </figcaption>
        </figure>
        <div className="lg:col-span-5 lg:pb-8">
          <h2 className="text-balance font-serif text-4xl font-medium leading-[1.12] text-foreground md:text-5xl">
            Premium skincare, finally accessible
          </h2>
          <p className="mt-8 text-pretty text-base font-light leading-relaxed text-muted-foreground md:text-lg">
            HAYDA SKINCo. was born from a simple frustration: finding authentic, dermatologist-trusted skincare in Nigeria was unnecessarily hard. Products were overpriced, often counterfeit, and always scattered across multiple stores.
          </p>
        </div>
      </section>

      <section className="border-y border-border">
        <p className="mx-auto max-w-4xl px-5 py-16 text-pretty font-serif text-2xl font-light leading-snug text-foreground md:py-24 md:text-3xl md:leading-snug lg:px-8">
          We built HAYDA to fix that. One destination, only verified brands — CeraVe, The Ordinary, La Roche-Posay, COSRX, Paula&apos;s Choice, and more — curated for every skin type, concern, and budget, with nationwide delivery from Lagos.
        </p>
      </section>

      <section className="bg-secondary">
        <div className="mx-auto max-w-7xl px-5 py-16 md:py-24 lg:px-8">
          <div className="max-w-xl">
            <p className="text-xs font-light uppercase tracking-[0.3em] text-gold">What We Stand For</p>
            <h2 className="mt-4 font-serif text-3xl font-medium text-foreground md:text-4xl">
              Our Promise
            </h2>
          </div>
          <div className="mt-12 divide-y divide-border border-y border-border">
            {values.map((value) => (
              <article key={value.title} className="grid gap-4 py-8 md:grid-cols-12 md:items-start md:gap-8 md:py-10">
                <div className="flex items-center gap-3 md:col-span-4">
                  <value.icon className="size-5 shrink-0 text-gold" aria-hidden />
                  <h3 className="font-serif text-2xl font-medium text-foreground">
                    {value.title}
                  </h3>
                </div>
                <p className="text-pretty text-sm font-light leading-relaxed text-muted-foreground md:col-span-7 md:col-start-6 md:text-base">
                  {value.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-24 text-center lg:px-8">
        <h2 className="text-balance font-serif text-3xl font-medium leading-tight text-foreground md:text-4xl">
          Begin your ritual
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-pretty text-sm font-light leading-relaxed text-muted-foreground md:text-base">
          Discover the formulas that have become quiet daily devotions for thousands.
        </p>
        <Link
          href="/shop"
          className="mt-8 inline-flex items-center gap-3 border border-foreground px-9 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-foreground transition-all duration-300 hover:border-gold hover:bg-gold hover:text-gold-foreground"
        >
          Explore the Collection
        </Link>
      </section>
    </>
  )
}
