import { redirect } from "next/navigation"
import { AdminAuthProvider } from "@/components/admin-auth-provider"
import { AdminSidebar } from "@/components/admin-sidebar"
import { createAdminServerClient } from "@/lib/supabase/server"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createAdminServerClient()

  // Production: never serve admin UI without a configured Supabase project
  if (!supabase) {
    if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SUPABASE_URL) {
      redirect("/admin/login")
    }
    // Local mock mode (no env) — client provider handles mock auth
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      redirect("/admin/login")
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_suspended")
      .eq("id", user.id)
      .maybeSingle()
    if (!profile || profile.role !== "admin" || profile.is_suspended) {
      redirect("/admin/login")
    }
  }

  return (
    <AdminAuthProvider>
      <div className="flex min-h-screen flex-col bg-background lg:flex-row">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </AdminAuthProvider>
  )
}
