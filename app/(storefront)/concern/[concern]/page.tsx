import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ProductCard } from "@/components/product-card"
import { ALL_CONCERNS, slugifyCatalogLabel, resolveCatalogLabel } from "@/lib/catalog"
import { queryProducts } from "@/lib/supabase/products"

function slugToLabel(slug: string) {
  return resolveCatalogLabel(ALL_CONCERNS, slug)
}

/**
 * 1h ISR (was build-time only, so new products never appeared until a redeploy).
 * Admin product saves refresh these pages on demand (app/actions/revalidate.ts).
 */
export const revalidate = 3600

export function generateStaticParams() {
  return ALL_CONCERNS.map(c => ({ concern: slugifyCatalogLabel(c) }))
}

export async function generateMetadata({ params }: { params: Promise<{ concern: string }> }): Promise<Metadata> {
  const { concern } = await params
  const label = slugToLabel(concern)
  if (!label) return {}
  return {
    title: `${label} — Shop by Concern · HAYDA SKINCo.`,
    description: `Browse products formulated for ${label.toLowerCase()}. Trusted brands, authentic products, delivered nationwide.`,
  }
}

const CONCERN_INFO: Record<string, { desc: string; tip: string }> = {
  "Acne":            { desc: "Targeted formulas to clear breakouts, reduce inflammation, and prevent future blemishes.",   tip: "Look for salicylic acid, niacinamide, and benzoyl peroxide." },
  "Hyperpigmentation":{ desc: "Brightening actives to fade dark spots, even skin tone, and restore a luminous complexion.", tip: "Vitamin C, niacinamide, and AHAs are your go-to ingredients." },
  "Anti-Ageing":     { desc: "Clinically proven anti-ageing formulas to smooth fine lines, firm skin, and boost elasticity.", tip: "Retinol, peptides, and antioxidants deliver the best results." },
  "Dry Skin":        { desc: "Rich, barrier-repairing formulas that lock in moisture and soothe tightness and flaking.",    tip: "Ceramides, hyaluronic acid, and glycerin are essential." },
  "Oily Skin":       { desc: "Lightweight, non-comedogenic formulas that balance sebum, minimise pores, and mattify.",      tip: "Niacinamide, BHA, and clay-based products work best." },
  "Sensitive Skin":  { desc: "Gentle, fragrance-free formulas that calm redness, reduce reactivity, and strengthen the skin barrier.", tip: "Avoid fragrance and alcohol; choose ceramide-rich formulas." },
  "Breakouts":       { desc: "Clear existing blemishes and keep future flare-ups at bay with balanced, non-stripping care.", tip: "Salicylic acid and niacinamide help without over-drying." },
  "Blackheads":      { desc: "Unclog pores and refine texture with gentle chemical exfoliation and oil-balancing formulas.", tip: "BHA and clay masks are especially effective here." },
  "Whiteheads":      { desc: "Dissolve congestion and keep pores clear with light, non-comedogenic treatments.", tip: "Look for salicylic acid and lightweight gel moisturisers." },
  "Clogged Pores":   { desc: "Deep-cleanse and exfoliate to free congested pores and restore a smoother surface.", tip: "AHAs, BHAs, and oil cleansers work well in rotation." },
  "Enlarged Pores":  { desc: "Minimise the look of pores with refining actives and oil-control essentials.", tip: "Niacinamide and gentle acids help refine appearance over time." },
  "Excess Oil":      { desc: "Rebalance sebum without stripping so skin stays matte, calm, and comfortable.", tip: "Niacinamide, zinc, and lightweight gels are your allies." },
  "Uneven Skin Tone":{ desc: "Brighten and even tone with targeted pigment-correcting and antioxidant formulas.", tip: "Vitamin C, niacinamide, and tranexamic acid pair well together." },
  "Dark Spots":      { desc: "Fade stubborn marks and restore clarity with brightening, spot-correcting actives.", tip: "Alpha arbutin, vitamin C, and consistent SPF matter most." },
  "Post-Acne Marks (PIH)": { desc: "Calm post-breakout marks and support clearer, more even-looking skin.", tip: "Niacinamide, azelaic acid, and gentle AHAs help fade PIH." },
  "Melasma":         { desc: "Support stubborn pigment with carefully chosen brighteners and diligent sun protection.", tip: "Tranexamic acid, vitamin C, and daily SPF are foundational." },
  "Dullness":        { desc: "Revive radiance with exfoliation, antioxidants, and hydration that bounce light back.", tip: "Vitamin C, AHAs, and hyaluronic acid brighten without harshness." },
  "Dryness":         { desc: "Replenish moisture and comfort tight, flaky skin with rich barrier support.", tip: "Ceramides, glycerin, and occlusives lock hydration in." },
  "Dehydration":     { desc: "Flood thirsty skin with water-binding humectants and seal them with light emollients.", tip: "Hyaluronic acid layered under a moisturiser works wonders." },
  "Rough Texture":   { desc: "Smooth bumps and roughness with gentle acids and consistent barrier care.", tip: "Lactic acid and ceramides refine without irritation." },
  "Uneven Texture":  { desc: "Polish and refine for a more uniform, soft-to-the-touch finish.", tip: "AHAs and retinoids gradually improve surface texture." },
  "Fine Lines":      { desc: "Soft-focus early lines with hydrating actives and gentle retinoids.", tip: "Retinol, peptides, and hyaluronic acid are a strong trio." },
  "Wrinkles":        { desc: "Support firmer-looking skin with proven anti-ageing and barrier-first formulas.", tip: "Retinoids, peptides, and antioxidants deliver lasting results." },
  "Loss of Firmness":{ desc: "Boost bounce and resilience with firming peptides and supportive moisturisers.", tip: "Peptides, retinoids, and consistent SPF help maintain firmness." },
  "Redness":         { desc: "Calm visible redness and reinforce a resilient, less reactive barrier.", tip: "Centella, panthenol, and fragrance-free formulas soothe best." },
  "Sensitivity":     { desc: "Keep reactive skin comfortable with ultra-gentle, barrier-focused care.", tip: "Skip fragrance and alcohol; prioritise ceramides and oat." },
  "Damaged Skin Barrier": { desc: "Repair and fortify a compromised barrier so skin can recover and thrive.", tip: "Ceramides, cholesterol, and fatty acids rebuild comfort." },
  "Irritation":      { desc: "Soothe flare-ups and reduce reactivity with calming, minimal-ingredient care.", tip: "Panthenol, allantoin, and centella calm irritated skin." },
  "Sun Damage":      { desc: "Support repair and prevent further photodamage with antioxidants and SPF.", tip: "Vitamin C by day, retinoids by night, SPF every morning." },
  "Keratosis Pilaris": { desc: "Smooth rough, bumpy areas with gentle acids and rich moisturising care.", tip: "Lactic acid, urea, and consistent emollients help KP." },
  "Body Acne":       { desc: "Clear body breakouts with targeted washes and lightweight, non-clogging treatments.", tip: "Salicylic acid body washes and benzoyl peroxide spot care help." },
  "Ingrown Hairs":   { desc: "Exfoliate and soothe to reduce bumps after shaving or waxing.", tip: "AHAs/BHAs and non-comedogenic moisturisers keep skin clear." },
  "Dark Under-Eyes": { desc: "Brighten and hydrate the delicate under-eye area for a more rested look.", tip: "Caffeine, vitamin C, and peptides are popular under-eye allies." },
  "Puffiness":       { desc: "Depuff and refresh tired eyes with cooling, fluid-moving actives.", tip: "Caffeine and cool compresses offer quick relief." },
}

const DEFAULT_CONCERN_INFO = {
  desc: "Browse products formulated to help with this skin concern. Trusted brands, authentic formulas.",
  tip: "Not sure where to start? Filter by ingredient or ask our team for a personalised recommendation.",
}

export default async function ConcernPage({ params }: { params: Promise<{ concern: string }> }) {
  const { concern } = await params
  const label = slugToLabel(concern)
  if (!label) notFound()

  const filtered = await queryProducts({ concern: label, limit: 1000 })
  const info = CONCERN_INFO[label] ?? {
    desc: `Products formulated to help with ${label.toLowerCase()}. Explore trusted brands selected for this concern.`,
    tip: DEFAULT_CONCERN_INFO.tip,
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      <Link href="/shop" className="mb-6 flex items-center gap-1.5 text-xs font-light uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-3.5" /> Shop
      </Link>

      <div className="mb-10 border-b border-border pb-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-gold mb-2">Shop by Concern</p>
        <h1 className="font-serif text-4xl font-medium">{label}</h1>
        <p className="mt-3 text-base font-light text-muted-foreground max-w-xl">{info.desc}</p>
        <div className="mt-4 inline-flex items-center gap-2 border border-gold/30 bg-lavender px-4 py-2.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-gold">Pro tip:</span>
          <span className="text-xs font-light text-foreground/80">{info.tip}</span>
        </div>
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
          <p className="mb-6 text-sm font-light text-muted-foreground">{filtered.length} product{filtered.length !== 1 ? "s" : ""} for {label}</p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </>
      )}

      {/* Other concerns */}
      <div className="mt-16 border-t border-border pt-10">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Other Concerns</p>
        <div className="flex flex-wrap gap-2">
          {ALL_CONCERNS.filter(c => c !== label).map(c => (
            <Link
              key={c}
              href={`/concern/${slugifyCatalogLabel(c)}`}
              className="border border-border px-4 py-2 text-xs font-light hover:border-gold hover:text-gold transition-colors"
            >
              {c}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
