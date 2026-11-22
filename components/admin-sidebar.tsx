"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useAdminAuth } from "@/components/admin-auth-provider"
import {
  LayoutDashboard,
  Package,
  BookOpen,
  Users,
  ShoppingBag,
  Tag,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Inbox,
  Store,
  FolderTree,
  Mail,
  FlaskConical,
} from "lucide-react"
import { cn } from "@/lib/utils"

type NavItem = {
  label: string
  href: string
  icon: typeof LayoutDashboard
  fullAdmin?: boolean
}

const NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    fullAdmin: true,
  },
  {
    label: "Orders",
    href: "/admin/orders",
    icon: ShoppingBag,
  },
  {
    label: "Products",
    href: "/admin/products",
    icon: Package,
  },
  {
    label: "Categories",
    href: "/admin/categories",
    icon: FolderTree,
  },
  {
    label: "Catalog Tags",
    href: "/admin/catalog",
    icon: FlaskConical,
  },
  {
    label: "Brands",
    href: "/admin/brands",
    icon: Store,
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: Users,
    fullAdmin: true,
  },
  {
    label: "Inbox",
    href: "/admin/inbox",
    icon: Inbox,
    fullAdmin: true,
  },
  {
    label: "Deals",
    href: "/admin/deals",
    icon: Tag,
    fullAdmin: true,
  },
  {
    label: "Journals",
    href: "/admin/journals",
    icon: BookOpen,
  },
  // {
  //   label: "Emails",
  //   href: "/admin/email-preview",
  //   icon: Mail,
  // },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { session, signOut } = useAdminAuth()
  const role = session?.role ?? "admin"
  const nav = NAV.filter(item => !item.fullAdmin || role === "admin")

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileOpen])

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile header bar — full width above content (layout is flex-col on mobile) */}
      <div className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <Link href="/admin" className="font-serif text-lg font-medium tracking-[0.2em] sm:text-xl sm:tracking-[0.25em]">
          HAYDA SKINCo.
        </Link>
        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((v) => !v)}
          className="flex size-9 items-center justify-center text-foreground"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-[min(16rem,85vw)] flex-col border-r border-border bg-sidebar transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:sticky lg:top-0 lg:h-full lg:w-64 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <Link href="/admin" className="font-serif text-xl font-medium tracking-[0.25em]">
              HAYDA SKINCo.
            </Link>
            <p className="text-[10px] font-light uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
              {role === "sub_admin" ? "Sub Admin" : "Admin"}
            </p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="text-foreground/60 hover:text-foreground lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-light uppercase tracking-[0.2em] text-muted-foreground">
            Management
          </p>
          <ul className="space-y-0.5">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <li key={item.href}>
                  {/* prefetch off: each admin prefetch is a dynamic render with auth checks (Vercel CPU budget). */}
                  <Link
                    href={item.href}
                    prefetch={false}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group flex items-center justify-between rounded-sm px-3 py-2.5 text-sm transition-all duration-150",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon
                        className={cn(
                          "size-4 transition-colors",
                          active ? "text-gold" : "text-muted-foreground group-hover:text-foreground/70",
                        )}
                      />
                      <span className="font-light">{item.label}</span>
                    </div>
                    {active && <ChevronRight className="size-3.5 text-gold" />}
                  </Link>
                </li>
              )
            })}
          </ul>

        </nav>

        {/* User / footer */}
        <div className="border-t border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-gold text-xs font-medium text-gold-foreground">
                {session?.name?.charAt(0).toUpperCase() ?? "A"}
              </div>
              <div>
                <p className="text-xs font-medium">{session?.name ?? "Admin"}</p>
                <p className="text-[10px] font-light text-muted-foreground truncate">{session?.email ?? ""}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
