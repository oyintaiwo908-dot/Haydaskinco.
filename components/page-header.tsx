import type { ReactNode } from "react"

/** Compact page heading band for listing and content pages. */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  /** Optional slot under the description (e.g. breadcrumbs or a meta line). */
  children?: ReactNode
}) {
  return (
    <section className="border-b border-border/70 bg-porcelain">
      <div className="mx-auto w-full min-w-0 max-w-7xl px-5 py-10 md:py-14 lg:px-8">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-rose break-words">{eyebrow}</p>
        )}
        <h1 className="mt-3 max-w-3xl font-serif text-[clamp(2rem,1.5rem+2vw,3.25rem)] font-normal leading-[1.08] tracking-[-0.01em] text-navy-deep text-balance break-words">
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground break-words">{description}</p>
        )}
        {children}
      </div>
    </section>
  )
}
