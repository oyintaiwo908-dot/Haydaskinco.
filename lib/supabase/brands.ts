/**
 * Admin brand CRUD helpers.
 */
import { createClient as createSb } from "@supabase/supabase-js"
import { createAdminBrowserClient, createClient } from "@/lib/supabase/client"
import { BRANDS as mockBrands } from "@/lib/products"

function getStorefrontReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (typeof window !== "undefined") return createClient() ?? createAdminBrowserClient()
  return createSb(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type Brand = {
  id: string
  name: string
  tagline: string
  logoUrl?: string | null
  isActive: boolean
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBrand(row: any): Brand {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline ?? "",
    logoUrl: row.logo_url,
    isActive: row.is_active !== false,
  }
}

export async function getBrandsForAdmin(): Promise<Brand[]> {
  const supabase = createAdminBrowserClient()
  if (!supabase) {
    return mockBrands.map(b => ({
      id: b.id,
      name: b.name,
      tagline: b.tagline,
      isActive: true,
    }))
  }

  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .order("name")

  if (error) {
    console.error("[brands] getBrandsForAdmin:", error.message)
    return []
  }
  return (data ?? []).map(rowToBrand)
}

/** Active brands for product form / storefront. */
export async function getActiveBrands(): Promise<Brand[]> {
  const supabase = getStorefrontReadClient()
  if (!supabase) {
    return mockBrands.map(b => ({
      id: b.id,
      name: b.name,
      tagline: b.tagline,
      isActive: true,
    }))
  }

  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("is_active", true)
    .order("name")

  if (error) {
    console.error("[brands] getActiveBrands:", error.message)
    return []
  }
  return (data ?? []).map(rowToBrand)
}

export async function saveBrand(values: {
  id?: string
  name: string
  tagline?: string
  isActive?: boolean
}): Promise<string> {
  const supabase = createAdminBrowserClient()
  if (!supabase) throw new Error("Supabase not configured.")

  const id = values.id?.trim() || slugify(values.name)
  if (!id) throw new Error("Brand name is required.")

  const row = {
    id,
    name: values.name.trim(),
    tagline: values.tagline?.trim() || null,
    is_active: values.isActive !== false,
  }

  const { error } = await supabase.from("brands").upsert(row, { onConflict: "id" })
  if (error) throw new Error(error.message)
  return id
}

export async function deleteBrand(id: string): Promise<void> {
  const supabase = createAdminBrowserClient()
  if (!supabase) return
  const { error } = await supabase.from("brands").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function toggleBrandActive(id: string, isActive: boolean): Promise<void> {
  const supabase = createAdminBrowserClient()
  if (!supabase) return
  const { error } = await supabase
    .from("brands")
    .update({ is_active: isActive })
    .eq("id", id)
  if (error) throw new Error(error.message)
}
