/**
 * Journal / Skin Blog query helpers.
 * Falls back to the static mock array ONLY when Supabase is not configured.
 * When Supabase is configured, errors are surfaced — never silently swapped for mock data.
 */
import { createClient as createSb } from "@supabase/supabase-js"
import { createClient, createAdminBrowserClient } from "@/lib/supabase/client"
import type { Journal } from "@/lib/journals"
import { journals as mockJournals } from "@/lib/journals"

function getStorefrontReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (typeof window !== "undefined") return createClient()
  return createSb(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToJournal(row: any): Journal {
  const publishedAt = row.published_at ?? row.created_at ?? new Date().toISOString()
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    content: row.body ?? row.content ?? "",
    category: row.category ?? "",
    author: row.author ?? "HAYDA Editorial",
    publishedAt: typeof publishedAt === "string" ? publishedAt.slice(0, 10) : publishedAt,
    image: row.cover_url ?? row.image ?? "/journal-ritual.png",
    readTime: row.read_time ? Number(row.read_time) : 5,
    status: row.is_published ? "published" : "draft",
    tags: Array.isArray(row.tags) ? row.tags : [],
  }
}

export async function getAllJournals(): Promise<Journal[]> {
  const supabase = createAdminBrowserClient()
  if (!supabase) return mockJournals

  const { data, error } = await supabase
    .from("journals")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[journals] getAllJournals:", error.message)
    return []
  }
  return (data ?? []).map(rowToJournal)
}

export async function getPublishedJournals(): Promise<Journal[]> {
  const supabase = getStorefrontReadClient()
  if (!supabase) return mockJournals.filter(j => j.status === "published")

  const { data, error } = await supabase
    .from("journals")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false })

  if (error) {
    console.error("[journals] getPublishedJournals:", error.message)
    return []
  }
  return (data ?? []).map(rowToJournal)
}

export async function getJournalBySlug(slug: string): Promise<Journal | null> {
  const supabase = createClient()
  if (!supabase) return mockJournals.find(j => j.slug === slug) ?? null

  const { data, error } = await supabase
    .from("journals")
    .select("*")
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    console.error("[journals] getJournalBySlug:", error.message)
    return null
  }
  return data ? rowToJournal(data) : null
}

export async function getJournalById(id: string): Promise<Journal | null> {
  const supabase = createAdminBrowserClient()
  if (!supabase) return mockJournals.find(j => j.id === id) ?? null

  const { data, error } = await supabase
    .from("journals")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[journals] getJournalById:", error.message, "id=", id)
    return null
  }
  if (!data) {
    console.warn("[journals] getJournalById: no row for id=", id)
    return null
  }
  return rowToJournal(data)
}

export async function getPublishedSlugs(): Promise<string[]> {
  const supabase = createClient()
  if (!supabase) return mockJournals.filter(j => j.status === "published").map(j => j.slug)

  const { data, error } = await supabase
    .from("journals")
    .select("slug")
    .eq("is_published", true)

  if (error || !data) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((r: any) => r.slug as string)
}

/** Upsert a journal article. Returns the saved id. */
export async function saveJournal(
  values: Partial<Journal> & { id?: string },
  existingId?: string,
): Promise<string> {
  const supabase = createAdminBrowserClient()
  if (!supabase) {
    console.warn("Supabase not configured — journal not persisted.")
    return existingId ?? "mock-" + Date.now()
  }

  const slug =
    values.slug ??
    values.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") ??
    ""

  const row = {
    slug,
    title: values.title ?? "",
    excerpt: values.excerpt ?? null,
    body: values.content ?? null,
    category: values.category ?? null,
    author: values.author ?? "HAYDA Editorial",
    cover_url: values.image && !values.image.startsWith("blob:") ? values.image : null,
    read_time: values.readTime ? String(values.readTime) : "5",
    is_published: values.status === "published",
    published_at:
      values.status === "published"
        ? (values.publishedAt ? new Date(values.publishedAt).toISOString() : new Date().toISOString())
        : null,
    tags: values.tags ?? [],
    updated_at: new Date().toISOString(),
  }

  const { data, error } = existingId
    ? await supabase.from("journals").update(row).eq("id", existingId).select("id").single()
    : await supabase.from("journals").insert(row).select("id").single()

  if (error) throw new Error(error.message)
  return data.id
}

export async function deleteJournal(id: string): Promise<void> {
  const supabase = createAdminBrowserClient()
  if (!supabase) return
  const { error } = await supabase.from("journals").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
