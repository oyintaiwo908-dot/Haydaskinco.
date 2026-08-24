import { createClient } from "@/lib/supabase/client"

export type ReviewRow = {
  id: string
  productId: string
  author: string
  authorInitial: string
  rating: number
  title: string
  body: string
  date: string
  verified: boolean
  helpful: number
  userId?: string | null
  productName?: string
  productImage?: string
  productCategory?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReview(row: any): ReviewRow {
  const name = row.author_name ?? "Customer"
  const initials = name
    .split(/\s+/)
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CU"
  const product = row.products
  return {
    id: row.id,
    productId: row.product_id,
    author: name,
    authorInitial: initials,
    rating: row.rating,
    title: row.title ?? "",
    body: row.body ?? "",
    date: (row.created_at ?? "").slice(0, 10),
    verified: Boolean(row.verified),
    helpful: row.helpful_count ?? 0,
    userId: row.user_id,
    productName: product?.name,
    productImage: product?.image_url ?? product?.image,
    productCategory: product?.category,
  }
}

export async function getReviewsForProduct(productId: string): Promise<ReviewRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[reviews] product:", error.message)
    return []
  }
  return (data ?? []).map(mapReview)
}

export async function getMyReviews(): Promise<ReviewRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // No embed — reviews→products FK was dropped in 020 for deal__* ids
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[reviews] mine:", error.message)
    return []
  }

  const rows = data ?? []
  const productIds = [
    ...new Set(
      rows
        .map(r => String(r.product_id ?? ""))
        .filter(id => id && !id.startsWith("deal__")),
    ),
  ]

  const productMeta = new Map<string, { name?: string; image_url?: string; category?: string }>()
  if (productIds.length) {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, image_url, category")
      .in("id", productIds)
    for (const p of products ?? []) {
      productMeta.set(String(p.id), p as { name?: string; image_url?: string; category?: string })
    }
  }

  return rows.map(row =>
    mapReview({
      ...row,
      products: productMeta.get(String(row.product_id)) ?? null,
    }),
  )
}

export async function submitReview(input: {
  productId: string
  rating: number
  title: string
  body: string
  authorName?: string
}): Promise<{ ok: boolean; message?: string; id?: string; verified?: boolean }> {
  const supabase = createClient()
  if (!supabase) return { ok: false, message: "Supabase not configured." }

  const { data, error } = await supabase.rpc("submit_review", {
    p_product_id: input.productId,
    p_rating: input.rating,
    p_title: input.title,
    p_body: input.body,
    p_author_name: input.authorName ?? "",
  })

  if (error) return { ok: false, message: error.message }
  if (data && typeof data === "object" && "ok" in data) {
    return {
      ok: Boolean((data as { ok: boolean }).ok),
      message: (data as { message?: string }).message,
      id: (data as { id?: string }).id,
      verified: (data as { verified?: boolean }).verified,
    }
  }
  return { ok: true }
}

export async function updateMyReview(
  id: string,
  patch: { rating: number; title: string; body: string },
): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return "Supabase not configured."

  const { error } = await supabase
    .from("reviews")
    .update({
      rating: patch.rating,
      title: patch.title,
      body: patch.body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  return error?.message ?? null
}

export async function deleteMyReview(id: string): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return "Supabase not configured."

  const { error } = await supabase.from("reviews").delete().eq("id", id)
  return error?.message ?? null
}

export async function markReviewHelpful(reviewId: string): Promise<{ ok: boolean; helpful?: number; message?: string }> {
  const supabase = createClient()
  if (!supabase) return { ok: false, message: "Supabase not configured." }

  const { data, error } = await supabase.rpc("mark_review_helpful", { p_review_id: reviewId })
  if (error) return { ok: false, message: error.message }
  if (data && typeof data === "object") {
    return {
      ok: Boolean((data as { ok: boolean }).ok),
      helpful: (data as { helpful_count?: number }).helpful_count,
      message: (data as { message?: string }).message,
    }
  }
  return { ok: true }
}
