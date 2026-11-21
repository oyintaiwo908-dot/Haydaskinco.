import { redirect } from "next/navigation"
import { AdminAuthProvider } from "@/components/admin-auth-provider"
import { AdminSidebar } from "@/components/admin-sidebar"
import { getAdminSession, isStoreRole } from "@/lib/admin-access"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Cached per request: nested requireFullAdmin() layouts reuse this lookup.
  const { configured, user, profile } = await getAdminSession()

  // Production: never serve admin UI without a configured Supabase project
  if (!configured) {
    if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SUPABASE_URL) {
      redirect("/admin/login")
    }
    // Local mock mode (no env) — client provider handles mock auth
  } else {
    if (!user) {
      redirect("/admin/login")
    }
    if (!profile || profile.is_suspended || !isStoreRole(profile.role)) {
      redirect(profile?.is_suspended ? "/admin/login?suspended=1" : "/admin/login")
    }
  }

  return (
    <AdminAuthProvider>
      <div className="admin-shell">
        <AdminSidebar />
        <div className="admin-main">{children}</div>
      </div>
    </AdminAuthProvider>
  )
}
