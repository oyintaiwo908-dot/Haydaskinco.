import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { ADMIN_AUTH_COOKIE } from "@/lib/supabase/auth-cookies"

function hasAuthCookie(request: NextRequest, cookieName: string): boolean {
  return request.cookies
    .getAll()
    .some(c => c.name === cookieName || c.name.startsWith(`${cookieName}.`))
}

function refreshSession(
  request: NextRequest,
  response: NextResponse,
  supabaseUrl: string,
  supabaseKey: string,
  cookieName: string,
) {
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: { name: cookieName },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })
  return supabase.auth.getUser()
}

/**
 * Runs only on /admin and /api/admin (see `config.matcher`). Every proxy run is a
 * billed Vercel Function invocation, so storefront pages, prefetches, assets and
 * customer APIs deliberately skip it: storefront auth is client-side, and customer
 * route handlers refresh their own session through lib/supabase/server.ts.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request })
  }

  const isAdminLogin =
    pathname === "/admin/login" ||
    pathname === "/admin/register" ||
    pathname.startsWith("/admin/login/") ||
    pathname.startsWith("/admin/register/")

  // Soft gate: require an admin auth cookie before serving /admin UI
  if (pathname.startsWith("/admin") && !isAdminLogin && !hasAuthCookie(request, ADMIN_AUTH_COOKIE)) {
    const login = request.nextUrl.clone()
    login.pathname = "/admin/login"
    login.searchParams.set("next", pathname)
    return NextResponse.redirect(login)
  }

  // Production: close open admin registration unless explicitly enabled
  const registerOpen =
    process.env.ALLOW_ADMIN_REGISTER === "true" || process.env.NODE_ENV !== "production"
  if (isAdminLogin && pathname.startsWith("/admin/register") && !registerOpen) {
    const login = request.nextUrl.clone()
    login.pathname = "/admin/login"
    return NextResponse.redirect(login)
  }

  const response = NextResponse.next({ request })

  // Admin session refresh only; the customer jar is not touched here any more.
  if (hasAuthCookie(request, ADMIN_AUTH_COOKIE)) {
    await refreshSession(request, response, supabaseUrl, supabaseKey, ADMIN_AUTH_COOKIE)
  }

  return response
}

export const config = {
  // Keep this narrow: widening it puts a function invocation in front of every request.
  matcher: ["/admin/:path*", "/api/admin/:path*"],
}
