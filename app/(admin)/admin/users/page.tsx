"use client"

import { useEffect, useState } from "react"
import {
  Search, MoreHorizontal, ShieldCheck, ShieldOff, Mail,
  Users, UserCheck, UserX, ChevronDown, SlidersHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/products"
import { AnchoredMenu } from "@/components/admin-anchored-menu"
import { useAdminListParams, useAdminScrollRestore } from "@/components/admin-list-state"
import {
  bulkSetSuspended,
  getAdminUsers,
  updateUserRole,
  updateUserSuspended,
  ADMIN_ROLE_LABEL,
  type AdminUser,
  type AdminUserRole,
  type AdminUserStatus,
} from "@/lib/supabase/users"

const STATUS_STYLES: Record<AdminUserStatus, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  suspended: "bg-destructive/10 text-destructive border-destructive/20",
}

const ROLE_STYLES: Record<AdminUserRole, string> = {
  admin: "bg-lavender text-lavender-foreground border-lavender-foreground/20",
  sub_admin: "bg-lavender text-gold border-gold/30",
  staff: "bg-muted text-muted-foreground border-border",
  customer: "bg-muted text-muted-foreground border-border",
}

const ROLE_OPTIONS: { role: AdminUserRole; label: string }[] = [
  { role: "admin", label: "Make Admin" },
  { role: "sub_admin", label: "Make Sub Admin" },
  { role: "customer", label: "Make User" },
]

function UserActions({
  user,
  open,
  onToggle,
  onToggleStatus,
  onSetRole,
  buttonClassName,
}: {
  user: AdminUser
  open: boolean
  onToggle: () => void
  onToggleStatus: () => void
  onSetRole: (role: AdminUserRole) => void
  buttonClassName: string
}) {
  return (
    <AnchoredMenu
      open={open}
      onToggle={onToggle}
      label="User actions"
      className={buttonClassName}
      icon={<MoreHorizontal className="size-4" />}
    >
      <button
        type="button"
        onClick={onToggleStatus}
        className={cn(
          "flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-light transition-colors hover:bg-muted",
          user.status === "active" ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-600",
        )}
      >
        {user.status === "active" ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
        {user.status === "active" ? "Suspend User" : "Activate User"}
      </button>
      {ROLE_OPTIONS.filter(option => option.role !== user.role).map(option => (
        <button
          key={option.role}
          type="button"
          onClick={() => onSetRole(option.role)}
          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-light text-foreground transition-colors hover:bg-muted"
        >
          <ChevronDown className="size-3.5" />
          {option.label}
        </button>
      ))}
      <a
        href={`mailto:${user.email}`}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-light text-foreground transition-colors hover:bg-muted"
      >
        <Mail className="size-3.5" /> Send Email
      </a>
    </AnchoredMenu>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  useAdminScrollRestore(!loading)
  // Search and filters live in the URL so the list reopens as it was.
  const [query, setQuery] = useAdminListParams({ q: "", role: "all", status: "all" })
  const search = query.q
  const setSearch = (v: string) => setQuery({ q: v })
  const roleFilter = query.role as "all" | AdminUserRole
  const setRoleFilter = (v: "all" | AdminUserRole) => setQuery({ role: v })
  const statusFilter = query.status as "all" | AdminUserStatus
  const setStatusFilter = (v: "all" | AdminUserStatus) => setQuery({ status: v })
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setUsers(await getAdminUsers())
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    const matchSearch = !search || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchRole = roleFilter === "all" || u.role === roleFilter
    const matchStatus = statusFilter === "all" || u.status === statusFilter
    return matchSearch && matchRole && matchStatus
  })

  async function toggleStatus(id: string) {
    const user = users.find(u => u.id === id)
    if (!user) return
    const suspend = user.status === "active"
    const error = await updateUserSuspended(id, suspend)
    setOpenMenu(null)
    if (error) {
      setMessage(error)
      return
    }
    await load()
  }

  async function setRole(id: string, role: AdminUserRole) {
    const error = await updateUserRole(id, role)
    setOpenMenu(null)
    if (error) {
      setMessage(error)
      return
    }
    await load()
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((u) => u.id)))
    }
  }

  const active = users.filter((u) => u.status === "active").length
  const suspended = users.filter((u) => u.status === "suspended").length
  const admins = users.filter((u) => u.role === "admin").length

  return (
    <div className="admin-page" onClick={() => setOpenMenu(null)}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif text-2xl font-medium">Users</h1>
          <p className="text-xs font-light text-muted-foreground mt-0.5">
            {loading ? "Loading…" : `${users.length} profiles from Supabase`}
          </p>
        </div>
        <span className="hidden sm:flex items-center gap-1.5 border border-border/60 bg-secondary px-3 py-1.5 text-[10px] font-light uppercase tracking-[0.15em] text-muted-foreground">
          <ShieldCheck className="size-3" /> Live
        </span>
      </div>

      <div className="admin-page-body">
        {message && (
          <p className="mb-4 border border-border bg-secondary px-4 py-3 text-sm font-light">{message}</p>
        )}

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Users", value: users.length, icon: Users, color: "text-foreground" },
            { label: "Active", value: active, icon: UserCheck, color: "text-green-600" },
            { label: "Suspended", value: suspended, icon: UserX, color: "text-destructive" },
            { label: "Admins", value: admins, icon: ShieldCheck, color: "text-gold" },
          ].map((stat) => (
            <div key={stat.label} className="border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-light uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
                <stat.icon className={cn("size-4", stat.color)} />
              </div>
              <p className="font-serif text-3xl font-medium">{loading ? "—" : stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-border bg-background py-2.5 pl-10 pr-4 text-sm font-light outline-none focus:border-foreground transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            {(["all", "customer", "admin", "sub_admin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={cn(
                  "border px-3 py-1.5 text-[11px] font-light uppercase tracking-[0.12em] transition-all",
                  roleFilter === r
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                )}
              >
                {r === "all" ? "All Roles" : ADMIN_ROLE_LABEL[r]}
              </button>
            ))}
            <span className="text-border">|</span>
            {(["all", "active", "suspended"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "border px-3 py-1.5 text-[11px] font-light uppercase tracking-[0.12em] transition-all capitalize",
                  statusFilter === s
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                )}
              >
                {s === "all" ? "All Status" : s}
              </button>
            ))}
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-4 flex items-center gap-3 border border-gold/30 bg-lavender px-4 py-3">
            <span className="text-xs font-medium">{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={async () => {
                const err = await bulkSetSuspended([...selectedIds], true)
                if (err) setMessage(err)
                setSelectedIds(new Set())
                await load()
              }}
              className="text-xs font-light text-destructive hover:underline underline-offset-2"
            >
              Suspend selected
            </button>
            <button
              type="button"
              onClick={async () => {
                const err = await bulkSetSuspended([...selectedIds], false)
                if (err) setMessage(err)
                setSelectedIds(new Set())
                await load()
              }}
              className="text-xs font-light text-green-600 hover:underline underline-offset-2"
            >
              Activate selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-xs font-light text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}

        <div className="admin-table-panel border border-border">
          {loading ? (
            <div className="h-48 bg-muted/20 animate-pulse" />
          ) : (
            <>
              <div className="admin-table-scroll hidden lg:block">
                <table className="admin-data-table w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      <th className="px-4 py-3 text-left w-10">
                        <div
                          onClick={selectAll}
                          className={cn(
                            "flex size-4 cursor-pointer items-center justify-center border transition-all",
                            selectedIds.size === filtered.length && filtered.length > 0
                              ? "border-gold bg-gold"
                              : "border-border",
                          )}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">User</th>
                      <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Role</th>
                      <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Orders</th>
                      <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Spent</th>
                      <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Joined</th>
                      <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((user) => (
                      <tr key={user.id} className={cn("hover:bg-secondary transition-colors", selectedIds.has(user.id) && "bg-secondary")}>
                        <td className="px-4 py-4">
                          <div
                            onClick={() => toggleSelect(user.id)}
                            className={cn(
                              "flex size-4 cursor-pointer items-center justify-center border transition-all",
                              selectedIds.has(user.id) ? "border-gold bg-gold" : "border-border hover:border-foreground",
                            )}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                              {user.avatar}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{user.name}</p>
                              <p className="text-xs font-light text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn("border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]", ROLE_STYLES[user.role])}>
                            {ADMIN_ROLE_LABEL[user.role]}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn("border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] capitalize", STATUS_STYLES[user.status])}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm font-light text-muted-foreground">{user.orders}</td>
                        <td className="px-4 py-4 text-sm font-medium">{formatPrice(user.totalSpent)}</td>
                        <td className="px-4 py-4 text-xs font-light text-muted-foreground">
                          {new Date(user.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end">
                            <UserActions
                              user={user}
                              open={openMenu === user.id}
                              onToggle={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                              onToggleStatus={() => toggleStatus(user.id)}
                              onSetRole={(role) => setRole(user.id, role)}
                              buttonClassName="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="admin-table-fill" aria-hidden="true">
                      <td colSpan={8} />
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-border lg:hidden">
                {filtered.map((user) => (
                  <div key={user.id} className="relative flex items-center gap-3 p-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {user.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.name}</p>
                      <p className="text-xs font-light text-muted-foreground truncate">{user.email}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={cn("border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em]", STATUS_STYLES[user.status])}>
                          {user.status}
                        </span>
                        <span className={cn("border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em]", ROLE_STYLES[user.role])}>
                          {ADMIN_ROLE_LABEL[user.role]}
                        </span>
                      </div>
                    </div>
                    <UserActions
                      user={user}
                      open={openMenu === user.id}
                      onToggle={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                      onToggleStatus={() => toggleStatus(user.id)}
                      onSetRole={(role) => setRole(user.id, role)}
                      buttonClassName="flex size-9 items-center justify-center text-muted-foreground hover:text-foreground"
                    />
                  </div>
                ))}
              </div>

              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Users className="size-10 text-muted-foreground mb-3" />
                  <p className="font-serif text-lg font-medium">No users found</p>
                  <p className="mt-1 text-sm font-light text-muted-foreground">Try adjusting your search or filters.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
