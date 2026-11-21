import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { getPublishedJournals } from "@/lib/supabase/journals"
import { ArrowRight, Clock } from "lucide-react"

export const metadata: Metadata = {
  title: "Journal — HAYDA SKINCo.",
  description:
    "Skincare tips, ingredient deep-dives, and product guides from the HAYDA SKINCo. team — everything you need for a better routine.",
}

/** 1h ISR; admin saves refresh it on demand (app/actions/revalidate.ts). Short windows burn Vercel CPU. */
export const revalidate = 3600

function formatPublished(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", day: "numeric", year: "numeric" })
}

export default async function JournalPage() {
  const publishedJournals = await getPublishedJournals()
  const [featured, ...rest] = publishedJournals
  return (
    <>
      <PageHeader
        eyebrow="The Journal"
        title="Notes on skin, ingredients and routine"
        description="Skincare guides, ingredient explainers and routine tips from the HAYDA SKINCo. team."
      />

      <div className="mx-auto max-w-7xl px-5 py-12 md:py-16 lg:px-8">
        {featured && (
          <article className="group grid items-end gap-8 lg:grid-cols-12 lg:gap-12">
            <Link
              href={`/journal/${featured.slug}`}
              tabIndex={-1}
              aria-hidden
              className="relative block aspect-[16/10] w-full overflow-hidden bg-porcelain lg:col-span-7"
            >
              <Image
                src={featured.image || "/placeholder.svg"}
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 58vw"
                className="object-cover transition-transform duration-700 ease-atelier group-hover:scale-[1.03]"
              />
            </Link>
            <div className="lg:col-span-5">
              <p className="flex flex-wrap items-center gap-4 text-xs font-medium uppercase tracking-[0.16em]">
                <span className="text-rose">Featured · {featured.category}</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock aria-hidden className="size-3.5" /> {featured.readTime} min read
                </span>
              </p>
              <h2 className="mt-4 text-balance font-serif text-[clamp(2rem,1.6rem+1.6vw,3rem)] leading-[1.08] text-navy-deep">
                <Link href={`/journal/${featured.slug}`} className="underline-offset-[6px] hover:underline">
                  {featured.title}
                </Link>
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">{featured.excerpt}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                By {featured.author} · {formatPublished(featured.publishedAt)}
              </p>
              <Link
                href={`/journal/${featured.slug}`}
                className="mt-6 inline-flex min-h-11 items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-navy underline-offset-4 hover:underline"
              >
                Read article <ArrowRight aria-hidden className="size-4" />
                <span className="sr-only">: {featured.title}</span>
              </Link>
            </div>
          </article>
        )}

        {rest.length > 0 && (
          <section className="mt-16 border-t border-border pt-10 md:mt-20" aria-labelledby="more-stories">
            <h2 id="more-stories" className="font-serif text-2xl text-navy-deep">More stories</h2>
            <ul className="mt-4 divide-y divide-border border-b border-border">
              {rest.map(article => (
                <li key={article.id}>
                  <Link
                    href={`/journal/${article.slug}`}
                    className="group grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-4 py-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-8"
                  >
                    <span className="relative block aspect-[4/3] overflow-hidden bg-porcelain">
                      <Image
                        src={article.image || "/placeholder.svg"}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 96px, 160px"
                        className="object-cover transition-transform duration-700 ease-atelier group-hover:scale-105"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="text-xs font-medium uppercase tracking-[0.14em] text-rose">{article.category}</span>
                      <span className="mt-1 block text-balance font-serif text-xl leading-snug text-navy-deep group-hover:underline group-hover:underline-offset-4 sm:text-2xl">
                        {article.title}
                      </span>
                      <span className="mt-2 line-clamp-2 hidden text-muted-foreground sm:block">{article.excerpt}</span>
                      <span className="mt-2 block text-sm text-muted-foreground">
                        {formatPublished(article.publishedAt)} · {article.readTime} min
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {publishedJournals.length === 0 && (
          <div className="py-24">
            <p className="font-serif text-2xl text-navy-deep">New articles coming soon.</p>
          </div>
        )}
      </div>
    </>
  )
}
