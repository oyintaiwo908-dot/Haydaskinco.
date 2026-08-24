import { redirect } from "next/navigation"
import AdminRegisterForm from "./register-form"

/** Open in development; production requires ALLOW_ADMIN_REGISTER=true. */
export default function AdminRegisterPage() {
  const allowed =
    process.env.ALLOW_ADMIN_REGISTER === "true" || process.env.NODE_ENV !== "production"
  if (!allowed) redirect("/admin/login")
  return <AdminRegisterForm />
}
