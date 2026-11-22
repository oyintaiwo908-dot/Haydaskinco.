import { redirect } from "next/navigation"
import { adminHomeFor, getAdminSession } from "@/lib/admin-access"

/** /admin: full admins land on the Dashboard, sub admins on Products (server-side). */
export default async function AdminIndexPage() {
  const { configured, profile } = await getAdminSession()
  // Local mock mode has no server-side role; the dashboard's client guard handles sub admins.
  redirect(configured ? adminHomeFor(profile?.role) : "/admin/dashboard")
}
