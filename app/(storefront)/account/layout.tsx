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
  { label: "Favorites", href: "/account/favorites", icon: Heart },
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
        <div className="mb-8 h-16 max-w-sm animate-pulse rounded-sm bg-muted" />
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
          <div className="hidden h-64 w-52 shrink-0 animate-pulse rounded-sm bg-muted lg:block" />
          <div className="h-48 flex-1 animate-pulse rounded-sm bg-muted" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 md:py-14 lg:px-8">
      {/* Page heading */}
      <div className="mb-8 border-b border-border pb-6">
        <p className="text-[11px] font-light uppercase tracking-[0.28em] text-gold mb-1.5">My Account</p>
        <h1 className="font-serif text-3xl font-medium">Welcome back, {session?.firstName ?? "there"}</h1>
        <p className="mt-1 text-sm font-light text-muted-foreground">Manage your orders, favourites, and details.</p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        {/* Sidebar nav — desktop */}
        <aside className="shrink-0 lg:w-52">
          <nav className="hidden lg:block space-y-0.5">
            {NAV.map(item => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center justify-between rounded-sm px-3 py-2.5 text-sm transition-all",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "font-light text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className={cn("size-4", active ? "text-gold" : "text-muted-foreground group-hover:text-foreground/70")} />
                    {item.label}
                  </div>
                  {active && <ChevronRight className="size-3.5 text-gold" />}
                </Link>
              )
            })}
            <button
              type="button"
              onClick={handleSignOut}
              className="group flex w-full items-center gap-2.5 rounded-sm px-3 py-2.5 text-sm font-light text-muted-foreground transition-all hover:bg-red-50 hover:text-destructive"
            >
              <LogOut className="size-4 text-muted-foreground group-hover:text-destructive" />
              Sign Out
            </button>
          </nav>

          {/* Mobile horizontal scroll nav */}
          <nav className="flex gap-1 overflow-x-auto no-scrollbar pb-1 lg:hidden">
            {NAV.map(item => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 border px-3 py-2 text-[11px] font-light uppercase tracking-[0.12em] transition-all",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              )
            })}
            <button
              type="button"
              onClick={handleSignOut}
              className="shrink-0 flex items-center gap-1.5 border border-border px-3 py-2 text-[11px] font-light uppercase tracking-[0.12em] text-muted-foreground transition-all hover:border-destructive hover:text-destructive"
            >
              <LogOut className="size-3.5" /> Sign Out
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
