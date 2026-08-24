import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { ADMIN_AUTH_COOKIE, CUSTOMER_AUTH_COOKIE } from "@/lib/supabase/auth-cookies"

type Scope = "customer" | "admin"

/**
 * Server Supabase client scoped to customer or admin cookie jar.
 * Default is customer (storefront APIs / checkout).
 */
export async function createClient(scope: Scope = "customer") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  const cookieStore = await cookies()
  const cookieName = scope === "admin" ? ADMIN_AUTH_COOKIE : CUSTOMER_AUTH_COOKIE

  return createServerClient(url, key, {
    cookieOptions: { name: cookieName },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Called from Server Components where cookies are read-only.
        }
      },
    },
  })
}

export async function createAdminServerClient() {
  return createClient("admin")
}
