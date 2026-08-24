/**
 * Category sections + subcategories (product.category stores subcategory name).
 */
import { createAdminBrowserClient, createClient } from "@/lib/supabase/client"

export type Category = {
  id: string
  sectionId: string
  name: string
  slug: string
  sortOrder: number
  isActive: boolean
}

export type CategorySection = {
  id: string
  name: string
  slug: string
  sortOrder: number
  isActive: boolean
  categories: Category[]
}

/** Static fallback when Supabase is not configured. */
export const DEFAULT_CATEGORY_TREE: CategorySection[] = [
  {
    id: "face",
    name: "Face",
    slug: "face",
    sortOrder: 1,
    isActive: true,
    categories: [
      { id: "cleansing-oils-balms", sectionId: "face", name: "Cleansing Oils & Balms", slug: "cleansing-oils-balms", sortOrder: 1, isActive: true },
      { id: "eye-creams-treatments", sectionId: "face", name: "Eye Creams & Treatments", slug: "eye-creams-treatments", sortOrder: 2, isActive: true },
      { id: "exfoliators-peels-scrubs", sectionId: "face", name: "Exfoliators, Peels & Scrubs", slug: "exfoliators-peels-scrubs", sortOrder: 3, isActive: true },
      { id: "face-cleansers-wash", sectionId: "face", name: "Face Cleansers & Wash", slug: "face-cleansers-wash", sortOrder: 4, isActive: true },
      { id: "face-mask", sectionId: "face", name: "Face Mask", slug: "face-mask", sortOrder: 5, isActive: true },
      { id: "face-moisturizers", sectionId: "face", name: "Face Moisturizers", slug: "face-moisturizers", sortOrder: 6, isActive: true },
      { id: "face-toners-mists", sectionId: "face", name: "Face Toners & Mists", slug: "face-toners-mists", sortOrder: 7, isActive: true },
      { id: "lipbalm-lip-oils", sectionId: "face", name: "Lipbalm & Lip Oils", slug: "lipbalm-lip-oils", sortOrder: 8, isActive: true },
      { id: "micellar-water", sectionId: "face", name: "Micellar Water", slug: "micellar-water", sortOrder: 9, isActive: true },
      { id: "serums-treatment", sectionId: "face", name: "Serums & Treatment", slug: "serums-treatment", sortOrder: 10, isActive: true },
      { id: "sunscreens", sectionId: "face", name: "Sunscreens", slug: "sunscreens", sortOrder: 11, isActive: true },
    ],
  },
  {
    id: "bath-and-body",
    name: "Bath and Body",
    slug: "bath-and-body",
    sortOrder: 2,
    isActive: true,
    categories: [
      { id: "body-moisturizers-oils", sectionId: "bath-and-body", name: "Body Moisturizers & Oils", slug: "body-moisturizers-oils", sortOrder: 1, isActive: true },
      { id: "body-scrubs", sectionId: "bath-and-body", name: "Body Scrubs", slug: "body-scrubs", sortOrder: 2, isActive: true },
      { id: "body-wash", sectionId: "bath-and-body", name: "Body Wash", slug: "body-wash", sortOrder: 3, isActive: true },
      { id: "cleansing-bar", sectionId: "bath-and-body", name: "Cleansing Bar", slug: "cleansing-bar", sortOrder: 4, isActive: true },
      { id: "hand-cream", sectionId: "bath-and-body", name: "Hand Cream", slug: "hand-cream", sortOrder: 5, isActive: true },
      { id: "personal-care", sectionId: "bath-and-body", name: "Personal Care", slug: "personal-care", sortOrder: 6, isActive: true },
    ],
  },
  {
    id: "perfume",
    name: "Perfume",
    slug: "perfume",
    sortOrder: 3,
    isActive: true,
    categories: [
      { id: "body-mist-and-spray", sectionId: "perfume", name: "Body mist and spray", slug: "body-mist-and-spray", sortOrder: 1, isActive: true },
      { id: "roll-on", sectionId: "perfume", name: "Roll on", slug: "roll-on", sortOrder: 2, isActive: true },
    ],
  },
]

export function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function flatCategories(tree: CategorySection[]): Category[] {
  return tree.flatMap(s => s.categories)
}

export function resolveCategoryName(
  tree: CategorySection[],
  slugOrName: string,
): string | null {
  if (!slugOrName || slugOrName === "All") return null
  const decoded = decodeURIComponent(slugOrName).trim()
  if (!decoded) return null
  const all = flatCategories(tree)
  const bySlug = all.find(c => c.slug === decoded || c.slug === slugifyCategory(decoded))
  if (bySlug) return bySlug.name
  const byName = all.find(c => c.name.toLowerCase() === decoded.toLowerCase())
  if (byName) return byName.name
  // Do not return raw slug — products store display names, not slugs
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSection(row: any, cats: Category[]): CategorySection {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sortOrder: Number(row.sort_order) || 0,
    isActive: row.is_active !== false,
    categories: cats
      .filter(c => c.sectionId === row.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCategory(row: any): Category {
  return {
    id: row.id,
    sectionId: row.section_id,
    name: row.name,
    slug: row.slug,
    sortOrder: Number(row.sort_order) || 0,
    isActive: row.is_active !== false,
  }
}

async function loadTree(
  admin: boolean,
  activeOnly: boolean,
): Promise<CategorySection[]> {
  const supabase = admin
    ? createAdminBrowserClient() ?? createClient()
    : createClient() ?? createAdminBrowserClient()
  if (!supabase) {
    return activeOnly
      ? DEFAULT_CATEGORY_TREE.map(s => ({
          ...s,
          categories: s.categories.filter(c => c.isActive),
        })).filter(s => s.isActive)
      : DEFAULT_CATEGORY_TREE
  }

  let sectionsQ = supabase.from("category_sections").select("*").order("sort_order")
  let catsQ = supabase.from("categories").select("*").order("sort_order")
  if (activeOnly) {
    sectionsQ = sectionsQ.eq("is_active", true)
    catsQ = catsQ.eq("is_active", true)
  }

  const [sectionsRes, catsRes] = await Promise.all([sectionsQ, catsQ])
  if (sectionsRes.error) {
    console.error("[categories] sections:", sectionsRes.error.message)
    return DEFAULT_CATEGORY_TREE
  }
  if (catsRes.error) {
    console.error("[categories] categories:", catsRes.error.message)
    return DEFAULT_CATEGORY_TREE
  }

  const cats = (catsRes.data ?? []).map(mapCategory)
  return (sectionsRes.data ?? []).map(row => mapSection(row, cats))
}

/** Active tree for storefront / product form. */
export async function getCategoryTree(): Promise<CategorySection[]> {
  return loadTree(false, true)
}

/** Full tree for admin CRUD (includes inactive). */
export async function getCategoryTreeForAdmin(): Promise<CategorySection[]> {
  return loadTree(true, false)
}

export async function saveCategorySection(values: {
  id?: string
  name: string
  slug?: string
  sortOrder?: number
  isActive?: boolean
}): Promise<string> {
  const supabase = createAdminBrowserClient()
  if (!supabase) throw new Error("Supabase not configured.")

  const name = values.name.trim()
  if (!name) throw new Error("Section name is required.")
  const id = values.id?.trim() || slugifyCategory(name)
  const slug = values.slug?.trim() || slugifyCategory(name)

  const row = {
    id,
    name,
    slug,
    sort_order: values.sortOrder ?? 0,
    is_active: values.isActive !== false,
    updated_at: new Date().toISOString(),
  }

  const { error } = values.id
    ? await supabase.from("category_sections").update(row).eq("id", values.id)
    : await supabase.from("category_sections").insert(row)

  if (error) throw new Error(error.message)
  return id
}

export async function deleteCategorySection(id: string): Promise<void> {
  const supabase = createAdminBrowserClient()
  if (!supabase) throw new Error("Supabase not configured.")
  const { error } = await supabase.from("category_sections").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function saveCategory(values: {
  id?: string
  sectionId: string
  name: string
  slug?: string
  sortOrder?: number
  isActive?: boolean
}): Promise<string> {
  const supabase = createAdminBrowserClient()
  if (!supabase) throw new Error("Supabase not configured.")

  const name = values.name.trim()
  if (!name) throw new Error("Category name is required.")
  if (!values.sectionId) throw new Error("Section is required.")

  const id = values.id?.trim() || slugifyCategory(name)
  const slug = values.slug?.trim() || slugifyCategory(name)

  const row = {
    id,
    section_id: values.sectionId,
    name,
    slug,
    sort_order: values.sortOrder ?? 0,
    is_active: values.isActive !== false,
    updated_at: new Date().toISOString(),
  }

  const { error } = values.id
    ? await supabase.from("categories").update(row).eq("id", values.id)
    : await supabase.from("categories").insert(row)

  if (error) throw new Error(error.message)
  return id
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = createAdminBrowserClient()
  if (!supabase) throw new Error("Supabase not configured.")
  const { error } = await supabase.from("categories").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function toggleCategoryActive(id: string, isActive: boolean): Promise<void> {
  const supabase = createAdminBrowserClient()
  if (!supabase) throw new Error("Supabase not configured.")
  const { error } = await supabase.from("categories").update({ is_active: isActive }).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function toggleSectionActive(id: string, isActive: boolean): Promise<void> {
  const supabase = createAdminBrowserClient()
  if (!supabase) throw new Error("Supabase not configured.")
  const { error } = await supabase.from("category_sections").update({ is_active: isActive }).eq("id", id)
  if (error) throw new Error(error.message)
}
