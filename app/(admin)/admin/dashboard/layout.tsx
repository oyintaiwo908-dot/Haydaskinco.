import { requireFullAdmin } from "@/lib/admin-access"

/** The Dashboard is for full admins only; sub admins are redirected to Products server-side. */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireFullAdmin()
  return children
}
