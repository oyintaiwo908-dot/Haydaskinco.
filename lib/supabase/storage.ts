/**
 * Supabase Storage helpers for product images.
 * Bucket: product-images (public)
 * Falls back gracefully when Supabase is not configured.
 */
import { createAdminBrowserClient } from "@/lib/supabase/client"

const BUCKET = "product-images"

/**
 * Upload a File to Supabase Storage and return its public URL.
 * @param file   The File object to upload
 * @param folder e.g. the product id slug — used as a path prefix
 */
export async function uploadProductImage(file: File, folder: string): Promise<string> {
  const supabase = createAdminBrowserClient()
  if (!supabase) {
    // Supabase not configured — return the blob URL as-is (dev / mock mode)
    return URL.createObjectURL(file)
  }

  // Bucket allowlists image MIME types (004_storage.sql); keep the extension in the same set.
  const rawExt = file.name.split(".").pop()?.toLowerCase() ?? ""
  const ext = ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(rawExt) ? rawExt : "jpg"
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
