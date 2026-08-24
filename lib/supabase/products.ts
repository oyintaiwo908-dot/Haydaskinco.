/**
 * Product query helpers.
 * Uses the browser Supabase client so the signed-in user's JWT is attached
 * to every request — required for RLS write policies (admin only).
 * Falls back to the local mock array ONLY when NEXT_PUBLIC_SUPABASE_URL is not set.
 *
 * Storefront reads should always go through queryProducts / helpers below so
 * filters, search, and limits run in the database as the catalog grows.
 */
import { createClient as createSb } from "@supabase/supabase-js"
import { createClient, createAdminBrowserClient } from "@/lib/supabase/client"
import type { Product } from "@/lib/products"
import { products as mockProducts, BRANDS as mockBrands } from "@/lib/products"

export type ProductQuery = {
  category?: string
  brand?: string
  concern?: string
  ingredient?: string
  skinType?: string
  search?: string
  discountOnly?: boolean
  /** Products with at least one quantity-promotion tier */
  tiersOnly?: boolean
  tag?: string
  priceMax?: number
  inStockOnly?: boolean
  minRating?: number
  excludeId?: string
  sort?: string
  limit?: number
  offset?: number
  /** Include unpublished (admin lists). */
  includeUnpublished?: boolean
  /** Full row for admin/PDP; card = grid fields only (default on storefront). */
  fields?: "card" | "full"
}

/** Columns needed for ProductCard / cart add — avoids shipping full PDP blobs on grids. */
const PRODUCT_CARD_SELECT =
  "id, name, brand_name, tagline, price, discount_pct, moq, price_tiers, image_url, category, categories, tag, tags, stock, rating, review_count, size, brands(name)"

const PRODUCT_FULL_SELECT = "*, brands(name)"

/** Default page size for unbounded storefront list queries. */
const DEFAULT_STOREFRONT_LIMIT = 96

export type BrandStorefrontSummary = {
  id: string
  name: string
  tagline: string
  productCount: number
  sampleNames: string[]
}

/** Browser auth client on client; plain anon client on server (public product reads). */
function getReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (typeof window !== "undefined") return createClient()
  return createSb(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Strip chars that break PostgREST `or` / `ilike` patterns. */
function sanitizeSearch(raw: string): string {
  return raw.replace(/[%_,.()"'\\]/g, " ").replace(/\s+/g, " ").trim()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToProduct(row: any): Product {
  const basePrice = Number(row.price) || 0
  const rawTiers = Array.isArray(row.price_tiers) ? row.price_tiers : []
  const priceTiers = rawTiers
    .map((t: { qty?: number; value?: number; price?: number }) => {
      const qty = Math.floor(Number(t.qty) || 0)
      let value = NaN
      if (t.value != null && Number.isFinite(Number(t.value))) {
        value = Math.round(Number(t.value))
      } else if (t.price != null && Number.isFinite(Number(t.price))) {
        // Legacy unit-price rows → absolute ₦ off base
        value = Math.max(0, basePrice - Math.round(Number(t.price)))
      }
      return { qty, value }
    })
    .filter((t: { qty: number; value: number }) => t.qty >= 2 && t.value > 0)
    .sort((a: { qty: number }, b: { qty: number }) => a.qty - b.qty)

  return {
    id: row.id,
    name: row.name,
    brand: row.brands?.name ?? row.brand_name ?? "",
    tagline: row.tagline ?? "",
    description: row.description ?? "",
    price: row.price,
    discountPct: Number(row.discount_pct ?? 0) || 0,
    moq: Math.max(1, Math.floor(Number(row.moq) || 1)),
    priceTiers: priceTiers.length ? priceTiers : undefined,
    image: row.image_url ?? row.image ?? "/product-cleanser.png",
    images: row.image_urls ?? undefined,
    category: (() => {
      const cats: string[] = Array.isArray(row.categories)
        ? row.categories.filter(Boolean)
        : []
      if (cats.length) return cats[0]
      return row.category ?? ""
    })(),
    categories: (() => {
      const cats: string[] = Array.isArray(row.categories)
        ? row.categories.filter(Boolean)
        : []
      if (cats.length) return cats
      return row.category ? [row.category] : []
    })(),
    tag: (() => {
      const tags: string[] = Array.isArray(row.tags) ? row.tags.filter(Boolean) : []
      if (tags.length) return tags[0]
      return row.tag ?? undefined
    })(),
    tags: (() => {
      const allowed = new Set(["Bestseller", "New", "Sale", "Low Stock"])
      const fromArr: string[] = Array.isArray(row.tags) ? row.tags.filter(Boolean) : []
      if (fromArr.length) return fromArr.filter(t => allowed.has(t)) as Product["tags"]
      return row.tag && allowed.has(row.tag) ? [row.tag as NonNullable<Product["tag"]>] : []
    })(),
    benefits: row.benefits ?? [],
    ingredients: row.ingredients ?? [],
    concerns: row.concerns ?? [],
    skinTypes: Array.isArray(row.skin_types) ? row.skin_types.filter(Boolean) : [],
    stock: row.stock ?? 0,
    rating: row.rating ?? 0,
    reviewCount: row.review_count ?? 0,
    size: row.size || undefined,
    variants: Array.isArray(row.variants) && row.variants.length > 0 ? row.variants : undefined,
    howToUse: row.how_to_use ?? undefined,
  } as Product
}

function filterMock(q: ProductQuery): Product[] {
  let list = [...mockProducts]
  if (q.category && q.category !== "All") {
    const needle = q.category.toLowerCase().replace(/-/g, " ")
    list = list.filter(p => {
      const cats = (p.categories?.length ? p.categories : [p.category]).map(c => c.toLowerCase())
      return cats.some(c => c.includes(needle) || c === q.category!.toLowerCase())
    })
  }
  if (q.brand && q.brand !== "All") list = list.filter(p => p.brand === q.brand)
  if (q.concern && q.concern !== "All") list = list.filter(p => p.concerns.includes(q.concern!))
  if (q.ingredient && q.ingredient !== "All") {
    list = list.filter(p => p.ingredients.some(i => i === q.ingredient))
  }
  if (q.skinType && q.skinType !== "All") {
    list = list.filter(p => (p.skinTypes ?? []).includes(q.skinType!))
  }
  if (q.discountOnly) list = list.filter(p => (p.discountPct ?? 0) > 0)
  if (q.tiersOnly) list = list.filter(p => (p.priceTiers?.length ?? 0) > 0)
  if (q.tag) list = list.filter(p => {
    const tags = p.tags?.length ? p.tags : (p.tag ? [p.tag] : [])
    return tags.includes(q.tag as never)
  })
  if (q.excludeId) list = list.filter(p => p.id !== q.excludeId)
  if (q.inStockOnly) list = list.filter(p => p.stock > 0)
  if (q.minRating && q.minRating > 0) list = list.filter(p => p.rating >= q.minRating!)
  if (q.priceMax != null) list = list.filter(p => p.price <= q.priceMax!)
  if (q.search?.trim()) {
    const s = q.search.trim().toLowerCase()
    list = list.filter(
      p =>
        p.name.toLowerCase().includes(s) ||
        p.tagline.toLowerCase().includes(s) ||
        p.category.toLowerCase().includes(s) ||
        (p.categories ?? []).some(c => c.toLowerCase().includes(s)) ||
        p.brand.toLowerCase().includes(s) ||
        p.description.toLowerCase().includes(s),
    )
  }

  if (q.sort === "price-asc") list.sort((a, b) => a.price - b.price)
  else if (q.sort === "price-desc") list.sort((a, b) => b.price - a.price)
  else if (q.sort === "rating") list.sort((a, b) => b.rating - a.rating)
  else if (q.sort === "reviews") list.sort((a, b) => b.reviewCount - a.reviewCount)
  else if (q.sort === "discount") {
    list.sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0))
  } else if (q.sort === "name") {
    list.sort((a, b) => a.name.localeCompare(b.name))
  }

  const offset = q.offset ?? 0
  const limit =
    q.limit != null
      ? q.limit
      : q.includeUnpublished
        ? undefined
        : DEFAULT_STOREFRONT_LIMIT
  if (limit != null) return list.slice(offset, offset + limit)
  if (offset > 0) return list.slice(offset)
  return list
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyProductFilters(query: any, q: ProductQuery) {
  if (q.category && q.category !== "All") {
    const cat = q.category.trim()
    // JSON.stringify quotes the value so & and spaces are safe once the client URL-encodes.
    // Match multi-category array OR legacy single category text.
    query = query.or(
      `categories.cs.{${JSON.stringify(cat)}},category.eq.${JSON.stringify(cat)}`,
    )
  }
  if (q.brand && q.brand !== "All") {
    query = query.eq("brand_name", q.brand)
  }
  if (q.concern && q.concern !== "All") {
    query = query.contains("concerns", [q.concern])
  }
  if (q.ingredient && q.ingredient !== "All") {
    query = query.contains("ingredients", [q.ingredient])
  }
  if (q.skinType && q.skinType !== "All") {
    query = query.contains("skin_types", [q.skinType])
  }
  if (q.discountOnly) {
    query = query.gt("discount_pct", 0)
  }
  if (q.tiersOnly) {
    query = query.neq("price_tiers", "[]")
  }
  if (q.tag) {
    const t = q.tag.replace(/"/g, '\\"')
    query = query.or(`tags.cs.{"${t}"},tag.eq."${t}"`)
  }
  if (q.excludeId) {
    query = query.neq("id", q.excludeId)
  }
  if (q.priceMax != null) {
    query = query.lte("price", q.priceMax)
  }
  if (q.inStockOnly) {
    query = query.gt("stock", 0)
  }
  if (q.minRating && q.minRating > 0) {
    query = query.gte("rating", q.minRating)
  }
  const search = q.search ? sanitizeSearch(q.search) : ""
  if (search) {
    const pattern = `%${search}%`
    query = query.or(
      `name.ilike."${pattern}",tagline.ilike."${pattern}",brand_name.ilike."${pattern}",category.ilike."${pattern}",description.ilike."${pattern}"`,
    )
  }
  return query
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyProductSort(query: any, sort?: string) {
  switch (sort) {
    case "price-asc":
      return query.order("price", { ascending: true })
    case "price-desc":
      return query.order("price", { ascending: false })
    case "rating":
      return query.order("rating", { ascending: false })
    case "reviews":
      return query.order("review_count", { ascending: false })
    case "discount":
      return query.order("discount_pct", { ascending: false })
    case "featured":
      return query.order("rating", { ascending: false })
    case "name":
      return query.order("name", { ascending: true })
    default:
      return query.order("created_at", { ascending: false })
  }
}

/** Filtered + sorted product query against Supabase (or mock). */
export async function queryProducts(q: ProductQuery = {}): Promise<Product[]> {
  const supabase = getReadClient()
  if (!supabase) return filterMock(q)

  const useFull = q.fields === "full" || q.includeUnpublished
  let query = supabase
    .from("products")
    .select(useFull ? PRODUCT_FULL_SELECT : PRODUCT_CARD_SELECT)

  if (!q.includeUnpublished) {
    query = query.eq("is_published", true)
  }

  query = applyProductFilters(query, q)
  query = applyProductSort(query, q.sort)

  const limit =
    q.limit != null
      ? q.limit
      : q.includeUnpublished
        ? undefined
        : DEFAULT_STOREFRONT_LIMIT

  if (limit != null) {
    const from = q.offset ?? 0
    query = query.range(from, from + limit - 1)
  } else if (q.offset != null && q.offset > 0) {
    query = query.range(q.offset, q.offset + 9999)
  }

  const { data, error } = await query
  if (error) {
    console.error("[products] queryProducts:", error.message)
    return []
  }
  let products = (data ?? []).map(rowToProduct)
  // Extra guard — some drivers may not filter empty jsonb arrays reliably
  if (q.tiersOnly) {
    products = products.filter(p => (p.priceTiers?.length ?? 0) > 0)
  }
  return products
}

/** Published products that have volume / wholesale quantity tiers. */
export async function getWholesaleProducts(limit = 48): Promise<Product[]> {
  return queryProducts({
    tiersOnly: true,
    inStockOnly: true,
    sort: "rating",
    limit,
  })
}

/** Count matching published products without loading rows. */
export async function countProducts(q: ProductQuery = {}): Promise<number> {
  const supabase = getReadClient()
  if (!supabase) {
    // filterMock already slices — recount without limit
    const { limit: _l, offset: _o, ...rest } = q
    return filterMock(rest).length
  }

  let query = supabase
    .from("products")
    .select("id", { count: "exact", head: true })

  if (!q.includeUnpublished) {
    query = query.eq("is_published", true)
  }

  query = applyProductFilters(query, q)

  const { count, error } = await query
  if (error) {
    console.error("[products] countProducts:", error.message)
    return 0
  }
  return count ?? 0
}

/** Admin product list page (includes unpublished). */
export async function getAdminProductsPage(q: {
  search?: string
  category?: string
  page?: number
  pageSize?: number
}): Promise<{ products: Product[]; total: number }> {
  const page = Math.max(1, q.page ?? 1)
  const pageSize = Math.max(1, q.pageSize ?? 20)
  const offset = (page - 1) * pageSize
  const base: ProductQuery = {
    search: q.search,
    category: q.category && q.category !== "All" ? q.category : undefined,
    includeUnpublished: true,
    sort: "name",
  }
  const supabase = createAdminBrowserClient() ?? getReadClient()
  if (!supabase) {
    const all = filterMock({ ...base })
    return {
      products: all.slice(offset, offset + pageSize),
      total: all.length,
    }
  }

  const [products, total] = await Promise.all([
    queryProducts({ ...base, limit: pageSize, offset }),
    countProducts(base),
  ])
  return { products, total }
}

/** Admin catalog — all products including unpublished. Do not use on storefront. */
export async function getAllProducts(): Promise<Product[]> {
  const supabase = createAdminBrowserClient()
  if (!supabase) return filterMock({})

  const { data, error } = await supabase
    .from("products")
    .select("*, brands(name)")
    .order("name")

  if (error) {
    console.error("[products] getAllProducts:", error.message)
    return []
  }
  return (data ?? []).map(rowToProduct)
}

export async function getProductById(id: string): Promise<Product | null> {
  const supabase = getReadClient()
  if (!supabase) return mockProducts.find(p => p.id === id) ?? null

  const { data, error } = await supabase
    .from("products")
    .select("*, brands(name)")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[products] getProductById:", error.message)
    return null
  }
  return data ? rowToProduct(data) : null
}

/** Batch product fetch by ids (published only). Preserves no particular order. */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return []

  const supabase = getReadClient()
  if (!supabase) {
    return unique
      .map(id => mockProducts.find(p => p.id === id))
      .filter((p): p is Product => Boolean(p))
  }

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_CARD_SELECT)
    .in("id", unique)
    .eq("is_published", true)

  if (error) {
    console.error("[products] getProductsByIds:", error.message)
    return []
  }
  return (data ?? []).map(rowToProduct)
}

export async function getProductIds(): Promise<string[]> {
  const supabase = getReadClient()
  if (!supabase) return mockProducts.map(p => p.id)

  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("is_published", true)

  if (error || !data) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((r: any) => r.id as string)
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const tagged = await getProductsByTag(["New", "Bestseller"], limit)
  if (tagged.length >= limit) return tagged

  const more = await queryProducts({ sort: "rating", limit: limit * 2 })
  const seen = new Set(tagged.map(p => p.id))
  const filled = [...tagged]
  for (const p of more) {
    if (seen.has(p.id)) continue
    filled.push(p)
    if (filled.length >= limit) break
  }
  return filled.slice(0, limit)
}

/** Published products matching one or more product tags (e.g. Bestseller, New). */
export async function getProductsByTag(
  tag: NonNullable<Product["tag"]> | NonNullable<Product["tag"]>[],
  limit = 8,
): Promise<Product[]> {
  const tags = Array.isArray(tag) ? tag : [tag]
  const supabase = getReadClient()
  if (!supabase) {
    return filterMock({ sort: "rating", limit: limit * 2 })
      .filter(p => {
        const pt = p.tags?.length ? p.tags : (p.tag ? [p.tag] : [])
        return pt.some(t => tags.includes(t))
      })
      .slice(0, limit)
  }

  if (tags.length === 1) {
    return queryProducts({ tag: tags[0], sort: "rating", limit })
  }

  // overlaps on tags[] OR legacy single tag in list
  const orParts = [
    `tags.ov.{${tags.map(t => `"${t}"`).join(",")}}`,
    ...tags.map(t => `tag.eq."${t}"`),
  ]
  const { data, error } = await supabase
    .from("products")
    .select("*, brands(name)")
    .eq("is_published", true)
    .or(orParts.join(","))
    .order("rating", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[products] getProductsByTag:", error.message)
    // Fallback: fetch per-tag
    const batches = await Promise.all(tags.map(t => queryProducts({ tag: t, sort: "rating", limit })))
    const seen = new Set<string>()
    const merged: Product[] = []
    for (const batch of batches) {
      for (const p of batch) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        merged.push(p)
        if (merged.length >= limit) return merged
      }
    }
    return merged
  }
  return (data ?? []).map(rowToProduct)
}

export async function getRelatedProducts(currentId: string, limit = 4): Promise<Product[]> {
  const current = await getProductById(currentId)
  if (!current) {
    return queryProducts({ excludeId: currentId, sort: "rating", limit })
  }

  const sameCategory = await queryProducts({
    category: current.category,
    excludeId: currentId,
    sort: "rating",
    limit,
  })
  if (sameCategory.length >= limit) return sameCategory

  const seen = new Set(sameCategory.map(p => p.id))
  const more = await queryProducts({ excludeId: currentId, sort: "rating", limit: limit * 2 })
  const filled = [...sameCategory]
  for (const p of more) {
    if (seen.has(p.id)) continue
    filled.push(p)
    if (filled.length >= limit) break
  }
  return filled.slice(0, limit)
}

export async function searchProducts(query: string, category?: string, limit = 40): Promise<Product[]> {
  return queryProducts({
    search: query.trim() || undefined,
    category: category && category !== "All" ? category : undefined,
    sort: "featured",
    limit,
  })
}

/** Published products with an active percentage discount. */
export async function getDiscountedProducts(q: Omit<ProductQuery, "discountOnly"> = {}): Promise<Product[]> {
  return queryProducts({
    ...q,
    discountOnly: true,
    sort: q.sort ?? "discount",
  })
}

/**
 * Brand cards for the storefront brands page.
 * Counts + sample names per brand via limited DB queries (not full catalog load).
 */
export async function getBrandStorefrontSummaries(): Promise<BrandStorefrontSummary[]> {
  const brands = await getAllBrands()
  const supabase = getReadClient()

  if (!supabase) {
    return brands
      .map(b => {
        const products = mockProducts.filter(p => p.brand === b.name)
        return {
          id: b.id,
          name: b.name,
          tagline: b.tagline,
          productCount: products.length,
          sampleNames: products.slice(0, 3).map(p => p.name),
        }
      })
      .filter(b => b.productCount > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  // Single catalog pass — avoid one query per brand
  const { data: rows, error } = await supabase
    .from("products")
    .select("name, brand_name, rating")
    .eq("is_published", true)
    .order("rating", { ascending: false })

  if (error) {
    console.error("[products] getBrandStorefrontSummaries:", error.message)
    return []
  }

  const byBrand = new Map<string, { count: number; samples: string[] }>()
  for (const row of rows ?? []) {
    const name = String((row as { brand_name?: string }).brand_name ?? "").trim()
    if (!name) continue
    const entry = byBrand.get(name) ?? { count: 0, samples: [] }
    entry.count += 1
    if (entry.samples.length < 3) {
      entry.samples.push(String((row as { name?: string }).name ?? ""))
    }
    byBrand.set(name, entry)
  }

  return brands
    .map(brand => {
      const entry = byBrand.get(brand.name)
      if (!entry || entry.count === 0) return null
      return {
        id: brand.id,
        name: brand.name,
        tagline: brand.tagline,
        productCount: entry.count,
        sampleNames: entry.samples.filter(Boolean),
      } satisfies BrandStorefrontSummary
    })
    .filter((s): s is BrandStorefrontSummary => s != null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Upsert a product row. Returns the saved product id or throws. */
export async function saveProduct(
  values: Omit<Product, "rating" | "reviewCount"> & { brand_id?: string },
  id?: string,
): Promise<string> {
  const supabase = createAdminBrowserClient()
  if (!supabase) {
    console.warn("Supabase not configured — product not persisted.")
    return id ?? "mock-" + Date.now()
  }

  const tiers = Array.isArray(values.priceTiers)
    ? values.priceTiers
        .map(t => ({
          qty: Math.floor(Number(t.qty) || 0),
          value: Math.round(Number(t.value) || 0),
        }))
        .filter(t => t.qty >= 2 && t.value > 0)
        .sort((a, b) => a.qty - b.qty)
    : []

  const categories = (values.categories?.length
    ? values.categories
    : values.category
      ? [values.category]
      : []
  ).map(c => c.trim()).filter(Boolean)

  const tags = (values.tags?.length
    ? values.tags
    : values.tag
      ? [values.tag]
      : []
  ).filter(Boolean)

  const row = {
    name: values.name,
    tagline: values.tagline,
    description: values.description,
    price: values.price,
    discount_pct: Math.min(100, Math.max(0, Math.round(Number(values.discountPct) || 0))),
    moq: Math.max(1, Math.floor(Number(values.moq) || 1)),
    price_tiers: tiers,
    image_url: values.image,
    image_urls: values.images,
    category: categories[0] ?? values.category ?? "",
    categories,
    tag: tags[0] ?? null,
    tags,
    benefits: values.benefits,
    ingredients: values.ingredients,
    concerns: values.concerns,
    skin_types: values.skinTypes ?? [],
    stock: values.stock,
    size: values.size ?? null,
    variants: values.variants ?? null,
    how_to_use: (values as Product & { howToUse?: string }).howToUse ?? null,
    is_published: true,
    brand_id: values.brand_id ?? null,
    brand_name: values.brand,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = id
    ? await supabase.from("products").update(row).eq("id", id).select("id").single()
    : await supabase.from("products").insert({ ...row, id: values.id }).select("id").single()

  if (error) throw new Error(error.message)

  // Auto-grow mutable catalogs when admins add custom ingredients/concerns
  const { ensureCatalogEntries } = await import("@/lib/supabase/catalog")
  await Promise.all([
    ensureCatalogEntries("ingredients", values.ingredients ?? []),
    ensureCatalogEntries("concerns", values.concerns ?? []),
  ])

  return data.id
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = createAdminBrowserClient()
  if (!supabase) return
  const { error } = await supabase.from("products").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function getAllBrands() {
  const supabase = getReadClient()
  if (!supabase) return mockBrands

  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .order("name")

  if (error || !data) return mockBrands
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((r: any) => ({
    id: r.id as string,
    name: r.name as string,
    tagline: (r.tagline ?? "") as string,
  }))
}
