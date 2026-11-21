"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { ALL_SKIN_TYPES, resolveCatalogLabel } from "@/lib/catalog"
import { getCategoryTree, resolveCategoryName, type CategorySection } from "@/lib/supabase/categories"
import { FREE_STANDARD_DELIVERY } from "@/lib/storefront-copy"

export type ShopHeadingText = { eyebrow: string; title: string; description: string }

function decodeParam(value: string | null) {
  if (!value) return undefined
  try {
    const decoded = decodeURIComponent(value).trim()
    return decoded || undefined
  } catch {
    const trimmed = value.trim()
    return trimmed || undefined
  }
}

/** Same wording rules the server used when /shop was rendered per request. */
function resolveHeading(
  params: URLSearchParams,
  tree: CategorySection[],
  fallback: ShopHeadingText,
): ShopHeadingText {
  const category = params.get("category")
  const categoryName = category ? resolveCategoryName(tree, category) ?? undefined : undefined
  const brandParam = decodeParam(params.get("brand"))
  const brandName = brandParam && brandParam !== "All" ? brandParam : undefined
  const skinParam = decodeParam(params.get("skinType"))
  const skinName =
    skinParam && skinParam !== "All" ? resolveCatalogLabel(ALL_SKIN_TYPES, skinParam) ?? skinParam : undefined
  const onSale = params.get("sale") === "true"
  const filter = params.get("filter")
  const named = [brandName, categoryName, skinName].filter((part): part is string => Boolean(part))

  if (named.length > 1) {
    const title = named.join(" · ")
    return { eyebrow: "Shop", title, description: `${title}. ${FREE_STANDARD_DELIVERY}.` }
  }
  if (categoryName) {
    return {
      eyebrow: "Shop",
      title: categoryName,
      description: `${categoryName} from HAYDA SKINCo. ${FREE_STANDARD_DELIVERY}.`,
    }
  }
  if (brandName) {
    return {
      eyebrow: "Shop by brand",
      title: brandName,
      description: `Authentic ${brandName} products. ${FREE_STANDARD_DELIVERY}.`,
    }
  }
  if (skinName) {
    return {
      eyebrow: "Shop by skin type",
      title: skinName,
      description: `Skincare for ${skinName.toLowerCase()}. ${FREE_STANDARD_DELIVERY}.`,
    }
  }
  if (onSale) {
    return { eyebrow: "Offers", title: "Sale", description: `Discounted skincare, while stocks last. ${FREE_STANDARD_DELIVERY}.` }
  }
  if (filter === "concerns") {
    return {
      eyebrow: "Discover",
      title: "Shop by Concern",
      description: `Choose a skin concern and see the products made for it. ${FREE_STANDARD_DELIVERY}.`,
    }
  }
  if (filter === "ingredients") {
    return {
      eyebrow: "Discover",
      title: "Shop by Ingredient",
      description: `Choose an ingredient and see the products that use it. ${FREE_STANDARD_DELIVERY}.`,
    }
  }
  return fallback
}

/**
 * /shop heading, resolved in the browser from the query string.
 * /shop is a static (ISR) page so it never runs a Vercel Function per visit; reading
 * searchParams on the server would make every visit and filter change a function render.
 */
export function ShopHeading({ fallback }: { fallback: ShopHeadingText }) {
  const searchParams = useSearchParams()
  const [tree, setTree] = useState<CategorySection[]>([])

  const hasCategory = Boolean(searchParams.get("category"))
  useEffect(() => {
    if (!hasCategory) return
    let cancelled = false
    getCategoryTree().then(t => {
      if (!cancelled) setTree(t)
    })
    return () => {
      cancelled = true
    }
  }, [hasCategory])

  const heading = resolveHeading(new URLSearchParams(searchParams.toString()), tree, fallback)
  return <PageHeader eyebrow={heading.eyebrow} title={heading.title} description={heading.description} />
}
