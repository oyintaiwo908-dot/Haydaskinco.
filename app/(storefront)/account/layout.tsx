"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard, ShoppingBag, Heart, Star, Settings, ChevronRight, LogOut, Gift,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUserAuth } from "@/components/user-auth-provider"

const NAV = [
  { label: "Overview",  href: "/account",          icon: LayoutDashboard },
  { label: "Orders",    href: "/account/orders",    icon: ShoppingBag },
  { label: "Favourites", href: "/account/favorites", icon: Heart },
  { label: "Rewards",   href: "/account/rewards",   icon: Gift },
  { label: "Reviews",   href: "/account/reviews",   icon: Star },
  { label: "Settings",  href: "/account/settings",  icon: Settings },
]

const AUTH_PATHS = ["/login", "/register"]

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { session, ready, signOut } = useUserAuth()
  const isAuthPage = AUTH_PATHS.some(p => pathname === p)

  // Guard: only redirect after auth has resolved — avoids /account → /login flash on reload
  useEffect(() => {
    if (!ready || isAuthPage) return
    if (!session) router.replace("/login")
  }, [ready, session, isAuthPage, router])

  function handleSignOut() {
    signOut()
    router.push("/login")
  }

  if (isAuthPage) return <>{children}</>

  if (!ready || session === null) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="mb-8 h-16 max-w-sm animate-pulse bg-muted/50" />
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
          <div className="hidden h-64 w-52 shrink-0 animate-pulse bg-muted/50 lg:block" />
          <div className="h-48 flex-1 animate-pulse bg-porcelain" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 md:py-14 lg:px-8">
      {/* Page heading */}
      <div className="mb-8 border-b border-border pb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-rose">My account</p>
        <h1 className="font-serif text-[clamp(2rem,1.6rem+1.6vw,3rem)] font-normal leading-tight text-navy-deep">Welcome back, {session?.firstName ?? "there"}</h1>
        <p className="mt-2 text-muted-foreground">Manage your orders, favourites and details.</p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        {/* Sidebar nav — desktop */}
        <aside className="shrink-0 lg:w-52">
          <nav aria-label="Account" className="hidden space-y-0.5 lg:block">
            {NAV.map(item => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex min-h-11 items-center justify-between px-3 text-sm transition-colors",
                    active
                      ? "bg-porcelain font-medium text-navy-deep"
                      : "text-muted-foreground hover:bg-porcelain hover:text-foreground",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon aria-hidden className={cn("size-4", active ? "text-navy" : "text-muted-foreground group-hover:text-foreground/70")} />
                    {item.label}
                  </div>
                  {active && <ChevronRight aria-hidden className="size-3.5 text-navy" />}
                </Link>
              )
            })}
            <button
              type="button"
              onClick={handleSignOut}
              className="group flex min-h-11 w-full items-center gap-2.5 px-3 text-sm text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
            >
              <LogOut aria-hidden className="size-4 text-muted-foreground group-hover:text-destructive" />
              Sign Out
            </button>
          </nav>

          {/* Mobile horizontal scroll nav */}
          <nav aria-label="Account" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:hidden">
            {NAV.map(item => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-1.5 rounded-control border px-3 text-xs font-medium uppercase tracking-[0.12em] transition-colors",
                    active
                      ? "border-navy bg-navy text-primary-foreground"
                      : "border-input text-foreground hover:border-navy",
                  )}
                >
                  <item.icon aria-hidden className="size-3.5" />
                  {item.label}
                </Link>
              )
            })}
            <button
              type="button"
              onClick={handleSignOut}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-control border border-input px-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
            >
              <LogOut aria-hidden className="size-3.5" /> Sign out
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
