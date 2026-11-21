import { cache } from "react"
import { redirect } from "next/navigation"
import { createAdminServerClient } from "@/lib/supabase/server"

export type StoreRole = "admin" | "sub_admin"

export function isStoreRole(role: string | null | undefined): role is StoreRole {
  return role === "admin" || role === "sub_admin"
}

type AdminProfile = { role: string | null; is_suspended: boolean | null }

/**
 * Admin cookie session + profile, read once per request.
 * The admin layout and the nested requireFullAdmin() layouts both need this; React
 * cache() dedupes it so one request does one getUser() and one profile query, not two each.
 * `configured: false` means no Supabase env (local mock mode only).
 */
export const getAdminSession = cache(async () => {
  const supabase = await createAdminServerClient()
  if (!supabase) return { configured: false as const, supabase: null, user: null, profile: null }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { configured: true as const, supabase, user: null, profile: null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_suspended")
    .eq("id", user.id)
    .maybeSingle<AdminProfile>()

  return { configured: true as const, supabase, user, profile: profile ?? null }
})

/** Full admins only. Sub admins are sent back to the dashboard. */
export async function requireFullAdmin() {
  const { configured, user, profile } = await getAdminSession()
  if (!configured) return

  if (!user) redirect("/admin/login")

  if (!profile || profile.is_suspended || !isStoreRole(profile.role)) {
    redirect(profile?.is_suspended ? "/admin/login?suspended=1" : "/admin/login")
  }
  if (profile.role !== "admin") redirect("/admin/dashboard")
}

/**
 * True only for a signed-in, non-suspended admin or sub admin, checked server-side
 * through the database's is_store_manager() (same rule RLS uses for catalogue writes).
 * Used by server actions, which are public endpoints and must not trust the caller.
 */
export async function hasStoreManagerSession(): Promise<boolean> {
  const { configured, supabase, user } = await getAdminSession()
  // Local mock mode (no Supabase env, never production): mirror the admin layout.
  if (!configured) {
    return process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_SUPABASE_URL
  }
  if (!user) return false
  const { data, error } = await supabase.rpc("is_store_manager")
  return !error && data === true
}
