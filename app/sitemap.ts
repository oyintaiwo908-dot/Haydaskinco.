import type { MetadataRoute } from "next"
import { ALL_CONCERNS, ALL_INGREDIENTS, slugifyCatalogLabel } from "@/lib/catalog"
import { getSiteUrl } from "@/lib/site"
import { getDealIds } from "@/lib/supabase/deals"
import { getPublishedSlugs } from "@/lib/supabase/journals"
import { getProductIds } from "@/lib/supabase/products"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl()
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.95 },
    { url: `${base}/offers`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/deals`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/brands`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${base}/journal`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/wholesale`, lastModified: now, changeFrequency: "monthly", priority: 0.65 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/shipping`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/returns`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/accessibility`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ]

  const [productIds, dealIds, journalSlugs] = await Promise.all([
    getProductIds().catch(() => [] as string[]),
    getDealIds().catch(() => [] as string[]),
    getPublishedSlugs().catch(() => [] as string[]),
  ])

  const productRoutes: MetadataRoute.Sitemap = productIds.map(id => ({
    url: `${base}/product/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  const dealRoutes: MetadataRoute.Sitemap = dealIds.map(id => ({
    url: `${base}/deal/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.75,
  }))

  const journalRoutes: MetadataRoute.Sitemap = journalSlugs.map(slug => ({
    url: `${base}/journal/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }))

  const concernRoutes: MetadataRoute.Sitemap = ALL_CONCERNS.map(label => ({
    url: `${base}/concern/${slugifyCatalogLabel(label)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.65,
  }))

  const ingredientRoutes: MetadataRoute.Sitemap = ALL_INGREDIENTS.map(label => ({
    url: `${base}/ingredient/${slugifyCatalogLabel(label)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.65,
  }))

  return [
    ...staticRoutes,
    ...productRoutes,
    ...dealRoutes,
    ...journalRoutes,
    ...concernRoutes,
    ...ingredientRoutes,
  ]
}
