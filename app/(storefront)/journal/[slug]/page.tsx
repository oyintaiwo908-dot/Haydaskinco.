import type { Metadata } from "next"
import { cache } from "react"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Clock, User, Tag } from "lucide-react"
import { getJournalBySlug, getPublishedJournals, getPublishedSlugs } from "@/lib/supabase/journals"

/** 1h ISR; admin saves refresh it on demand (app/actions/revalidate.ts). Short windows burn Vercel CPU. */
export const revalidate = 3600

/** One article fetch per render, shared by generateMetadata and the page. */
const getArticle = cache((slug: string) => getJournalBySlug(slug))

/* ─── Static params ─────────────────────────────────────────── */
export async function generateStaticParams() {
  const slugs = await getPublishedSlugs()
  return slugs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) return {}
  return {
    title: `${article.title} — HAYDA Journal`,
    description: article.excerpt,
  }
}

/* ─── Markdown renderer ─────────────────────────────────────── */
function renderInline(text: string): React.ReactNode {
  // Bold + italic → **text** and *text*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-medium text-foreground">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic">{part.slice(1, -1)}</em>
    }
    return part
  })
}

function MarkdownContent({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/)

  return (
    <div>
      {blocks.map((block, i) => {
        const trimmed = block.trim()
        if (!trimmed) return null

        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={i} className="font-serif text-[1.75rem] leading-snug text-navy-deep mt-14 mb-3 first:mt-0">
              {trimmed.slice(3)}
            </h2>
          )
        }
        if (trimmed.startsWith("# ")) {
          // The page title is the only h1; in-article "#" headings render as h2.
          return (
            <h2 key={i} className="font-serif text-3xl leading-tight text-navy-deep mt-12 first:mt-0">
              {trimmed.slice(2)}
            </h2>
          )
        }

        // Multi-line block — preserve line breaks as <br>
        const lines = trimmed.split("\n")
        return (
          <p key={i} className="mt-6 text-[17px] leading-[1.8] text-foreground/85 first:mt-0">
            {lines.map((line, j) => (
              <span key={j}>
                {renderInline(line)}
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

/* ─── Share buttons (client component) ─────────────────────── */
import { ShareButtons } from "./share-buttons"

/* ─── Page ──────────────────────────────────────────────────── */
export default async function JournalArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [article, allPublished] = await Promise.all([
    getArticle(slug),
    getPublishedJournals(),
  ])
  if (!article || article.status !== "published") notFound()

  const related = allPublished
    .filter(j => j.id !== article.id && j.category === article.category)
    .slice(0, 2)

  const otherRelated = related.length < 2
    ? allPublished.filter(j => j.id !== article.id && !related.find(r => r.id === j.id)).slice(0, 2 - related.length)
    : []

  const suggestions = [...related, ...otherRelated]

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:py-14 lg:px-8">
      {/* Reading progress: CSS scroll timeline, no JS (hidden where unsupported) */}
      <div className="reading-progress" aria-hidden />

      {/* Back */}
      <Link
        href="/journal"
        className="mb-8 inline-flex min-h-11 items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-navy"
      >
        <ArrowLeft aria-hidden className="size-4" /> Journal
      </Link>

      <div className="grid items-start gap-14 lg:grid-cols-[minmax(0,40rem)_17.5rem] lg:justify-center lg:gap-x-16">

        {/* Main article */}
        <article className="min-w-0 max-w-[40rem]">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-[0.16em]">
            <span className="text-rose">{article.category}</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock aria-hidden className="size-3.5" /> {article.readTime} min read
            </span>
          </div>

          {/* Title */}
          <h1 className="mt-5 text-balance font-serif text-[clamp(2.25rem,1.7rem+2.2vw,3.5rem)] font-normal leading-[1.06] text-navy-deep">
            {article.title}
          </h1>

          {/* Byline */}
          <div className="mt-6 flex flex-wrap items-center gap-4 border-b border-border pb-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <User aria-hidden className="size-4" /> {article.author}
            </span>
            <span>
              {new Date(article.publishedAt).toLocaleDateString("en-GB", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>

          {/* Hero image */}
          <div className="relative mt-10 aspect-[16/9] w-full overflow-hidden bg-porcelain">
            <Image
              src={article.image || "/placeholder.svg"}
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 65vw"
              className="object-cover"
            />
          </div>

          {/* Excerpt */}
          <p className="mt-10 max-w-[65ch] border-l-2 border-rose pl-5 font-serif text-xl italic leading-relaxed text-navy-deep md:text-2xl">
            {article.excerpt}
          </p>

          {/* Body */}
          <div className="mt-10 max-w-[65ch]">
            <MarkdownContent content={article.content} />
          </div>

          {/* Tags */}
          {article.tags.length > 0 && (
            <div className="mt-12 flex flex-wrap items-center gap-2 border-t border-border pt-6">
              <Tag className="size-3.5 text-muted-foreground" />
              {article.tags.map(tag => (
                <span key={tag} className="rounded-control border border-border px-3 py-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Share buttons */}
          <ShareButtons title={article.title} slug={article.slug} />
        </article>

        {/* Sidebar */}
        <aside className="space-y-8">
          {/* About the author */}
          <div className="border border-border p-5">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Written by</p>
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                {article.author.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium">{article.author}</p>
                <p className="text-xs font-light text-muted-foreground">HAYDA SKINCo.</p>
              </div>
            </div>
          </div>

          {/* Read more */}
          {suggestions.length > 0 && (
            <div>
              <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">More to Read</p>
              <div className="space-y-5">
                {suggestions.map(s => (
                  <Link key={s.id} href={`/journal/${s.slug}`} className="group flex gap-3">
                    <div className="relative size-16 shrink-0 overflow-hidden bg-porcelain">
                      <Image src={s.image || "/placeholder.svg"} alt="" fill sizes="64px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-rose">{s.category}</p>
                      <p className="mt-0.5 text-sm font-medium leading-snug text-navy-deep group-hover:underline group-hover:underline-offset-4 line-clamp-2">{s.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{s.readTime} min read</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="bg-porcelain p-5">
            <p className="font-serif text-xl leading-snug text-navy-deep">Explore our collection</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Discover the products behind the rituals in the Journal.
            </p>
            <Link
              href="/shop"
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-navy underline-offset-4 hover:underline"
            >
              Shop now <ArrowLeft aria-hidden className="size-3.5 rotate-180" />
            </Link>
          </div>
        </aside>

      </div>

      {/* Bottom nav */}
      <div className="mt-16 border-t border-border pt-8">
        <Link
          href="/journal"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-navy underline-offset-4 hover:underline"
        >
          <ArrowLeft aria-hidden className="size-4" /> Back to the Journal
        </Link>
      </div>

    </div>
  )
}
