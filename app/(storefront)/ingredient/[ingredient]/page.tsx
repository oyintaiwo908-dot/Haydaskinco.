import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ProductCard } from "@/components/product-card"
import { ALL_INGREDIENTS, slugifyCatalogLabel, resolveCatalogLabel } from "@/lib/catalog"
import { queryProducts } from "@/lib/supabase/products"

function slugToLabel(slug: string) {
  return resolveCatalogLabel(ALL_INGREDIENTS, slug)
}

export function generateStaticParams() {
  return ALL_INGREDIENTS.map(i => ({ ingredient: slugifyCatalogLabel(i) }))
}

export async function generateMetadata({ params }: { params: Promise<{ ingredient: string }> }): Promise<Metadata> {
  const { ingredient } = await params
  const label = slugToLabel(ingredient)
  if (!label) return {}
  return {
    title: `${label} Products — HAYDA SKINCo.`,
    description: `Shop skincare products with ${label}. Authenticated products from trusted brands, delivered across Nigeria.`,
  }
}

const INGREDIENT_INFO: Record<string, { desc: string; best: string }> = {
  "Vitamin C":       { desc: "A powerful antioxidant that brightens skin, fades dark spots, and boosts collagen synthesis.",    best: "Best for: Hyperpigmentation, dullness, anti-ageing." },
  "Retinol":         { desc: "The gold standard of anti-ageing. Accelerates cell turnover, smooths wrinkles, and refines texture.", best: "Best for: Fine lines, uneven texture, anti-ageing." },
  "Niacinamide":     { desc: "A multi-tasking B3 vitamin that reduces blemishes, minimises pores, and evens skin tone.",         best: "Best for: Acne, oily skin, hyperpigmentation." },
  "AHA/BHA":         { desc: "Chemical exfoliants that dissolve dead skin cells to reveal brighter, smoother skin.",            best: "Best for: Texture, dark spots, clogged pores." },
  "Hyaluronic Acid": { desc: "A super-hydrator that attracts and holds 1000× its weight in water for plump, dewy skin.",        best: "Best for: Dry skin, all skin types." },
  "SPF":             { desc: "Sun protection is the single most effective anti-ageing and hyperpigmentation prevention tool.",   best: "Best for: Everyone, every day." },
  "Ceramides":       { desc: "Naturally occurring lipids that form the skin's protective barrier and retain moisture.",          best: "Best for: Dry, sensitive, barrier-damaged skin." },
}

export default async function IngredientPage({ params }: { params: Promise<{ ingredient: string }> }) {
  const { ingredient } = await params
  const label = slugToLabel(ingredient)
  if (!label) notFound()

  const filtered = await queryProducts({ ingredient: label, limit: 1000 })
  const info = INGREDIENT_INFO[label] ?? {
    desc: `Shop authenticated products featuring ${label}, curated for Nigerian skin.`,
    best: "Browse the selection below or explore related actives.",
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      <Link href="/shop" className="mb-6 flex items-center gap-1.5 text-xs font-light uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-3.5" /> Shop
      </Link>

      <div className="mb-10 border-b border-border pb-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-gold mb-2">Shop by Ingredient</p>
        <h1 className="font-serif text-4xl font-medium">{label}</h1>
        <p className="mt-3 text-base font-light text-muted-foreground max-w-xl">{info.desc}</p>
        <p className="mt-2 text-sm font-light text-gold">{info.best}</p>
      </div>

      {filtered.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-serif text-2xl font-medium text-muted-foreground">More products coming soon.</p>
          <Link href="/shop" className="mt-6 inline-flex items-center gap-2 border border-border px-8 py-3 text-xs font-medium uppercase tracking-[0.15em] hover:border-foreground transition-colors">
            Browse all products
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-6 text-sm font-light text-muted-foreground">{filtered.length} product{filtered.length !== 1 ? "s" : ""} containing {label}</p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </>
      )}

      <div className="mt-16 border-t border-border pt-10">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Other Ingredients</p>
        <div className="flex flex-wrap gap-2">
          {ALL_INGREDIENTS.filter(i => i !== label).map(i => (
            <Link
              key={i}
              href={`/ingredient/${slugifyCatalogLabel(i)}`}
              className="border border-border px-4 py-2 text-xs font-light hover:border-gold hover:text-gold transition-colors"
            >
              {i}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
