/**
 * Where each admin role lands (client- and server-safe; no server imports here).
 * Sub admins have no Dashboard (owner decision): their first usable section is Products.
 */
export const ADMIN_HOME = { admin: "/admin/dashboard", sub_admin: "/admin/products" } as const

export function adminHomeFor(role: string | null | undefined): string {
  return role === "sub_admin" ? ADMIN_HOME.sub_admin : ADMIN_HOME.admin
}
