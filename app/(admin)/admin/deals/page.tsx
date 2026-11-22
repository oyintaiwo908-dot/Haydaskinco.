"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { Plus, Search, Edit2, Trash2, Tag, ToggleLeft, ToggleRight, RefreshCw } from "lucide-react"
import { type Deal } from "@/lib/deals"
import { getAllDeals, deleteDeal, toggleDealStatus } from "@/lib/supabase/deals"
import { revalidateDeals } from "@/app/actions/revalidate"
import { cn } from "@/lib/utils"
import { useAdminListParams, useAdminScrollRestore } from "@/components/admin-list-state"

/** Storefront deal pages cache for up to 1h; refresh them after a change (non-blocking). */
function refreshStorefrontDeals(id: string) {
  void revalidateDeals(id).then(r => {
    if (!r.ok) console.warn("[deal] storefront refresh skipped:", r.error)
  })
}

const STATUS_STYLE: Record<Deal["status"], { label: string; cls: string }> = {
  active:   { label: "Active",   cls: "bg-green-50 text-green-700 border-green-200" },
  draft:    { label: "Draft",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
  archived: { label: "Archived", cls: "bg-zinc-100 text-zinc-500 border-zinc-200" },
}

export default function AdminDealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  useAdminScrollRestore(!loading)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getAllDeals()
    setDeals(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  // Search and filter live in the URL so returning from an edit reopens this view.
  const [query, setQuery] = useAdminListParams({ q: "", status: "all" })
  const search = query.q
  const setSearch = (v: string) => setQuery({ q: v })
  const statusFilter = query.status as "all" | Deal["status"]
  const setStatusFilter = (v: "all" | Deal["status"]) => setQuery({ status: v })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filtered = deals.filter(d => {
    const matchSearch = !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.brand.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "all" || d.status === statusFilter
    return matchSearch && matchStatus
  })

  async function toggleStatus(id: string) {
    const deal = deals.find(d => d.id === id)
    if (!deal) return
    const isActive = deal.status !== "active"
    setDeals(prev => prev.map(d => d.id !== id ? d : { ...d, status: isActive ? "active" : "draft" }))
    await toggleDealStatus(id, isActive)
    refreshStorefrontDeals(id)
  }

  async function confirmDelete(id: string) {
    try { await deleteDeal(id) } catch { /* fall through */ }
    refreshStorefrontDeals(id)
    setDeals(prev => prev.filter(d => d.id !== id))
    setDeleteId(null)
  }

  const activeCount = deals.filter(d => d.status === "active").length

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif text-2xl font-medium">Deals & Bundles</h1>
          <p className="text-xs font-light text-muted-foreground mt-0.5">
            {loading ? "Loading…" : `${deals.length} deals — ${activeCount} live on storefront`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="flex size-9 items-center justify-center border border-border text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
          <Link
            href="/admin/deals/new"
            className="flex items-center gap-2 bg-foreground px-5 py-2.5 text-xs font-medium uppercase tracking-[0.15em] text-background transition-colors hover:bg-gold hover:text-gold-foreground"
          >
            <Plus className="size-3.5" /> New Deal
          </Link>
        </div>
      </div>

      <div className="admin-page-body">
        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search deals…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-border bg-background py-2.5 pl-10 pr-4 text-sm font-light outline-none focus:border-foreground transition-colors"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "active", "draft", "archived"] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 text-xs font-light capitalize transition-colors",
                  statusFilter === s
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table / cards */}
        <div className="admin-table-panel border border-border">
          <div className="admin-table-scroll hidden md:block">
          <table className="admin-data-table w-full text-sm">
            <thead className="border-b border-border bg-muted">
              <tr>
                <th className="px-5 py-3.5 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Deal</th>
                <th className="hidden px-5 py-3.5 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground md:table-cell">Items</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Price</th>
                <th className="hidden px-5 py-3.5 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:table-cell">Status</th>
                <th className="px-5 py-3.5 text-right text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(deal => (
                <tr key={deal.id} className="group transition-colors hover:bg-secondary">
                  {/* Deal info */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative size-12 shrink-0 overflow-hidden border border-border bg-muted">
                        {deal.image && deal.image !== "/product-bundle.png" ? (
                          <Image src={deal.image} alt="" fill className="object-cover" sizes="48px" />
                        ) : (
                          <div className="flex size-full items-center justify-center border-gold/30 bg-lavender">
                            <Tag className="size-4 text-gold/70" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium leading-none">{deal.title}</p>
                          {deal.highlight && (
                            <span className="border border-gold/40 bg-lavender px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.15em] text-gold">
                              Featured
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs font-light text-muted-foreground">{deal.brand} · {deal.badge || (deal.discountPct ? `Save ${deal.discountPct}%` : "")}</p>
                        <p className="mt-0.5 text-[10px] font-light text-gold">
                          {(deal.concerns?.length ? deal.concerns : deal.concern ? [deal.concern] : []).join(" · ")}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Items count */}
                  <td className="hidden px-5 py-4 md:table-cell">
                    <div className="space-y-0.5">
                      {deal.items.map(item => (
                        <p key={`${item.productId}-${item.variantLabel ?? item.size}-${item.name}`} className="text-xs font-light text-muted-foreground">
                          · {item.name}{item.size ? ` (${item.size})` : ""}
                        </p>
                      ))}
                    </div>
                  </td>

                  {/* Price */}
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium">₦{deal.salePrice.toLocaleString()}</p>
                    <p className="text-xs font-light line-through text-muted-foreground">₦{deal.originalPrice.toLocaleString()}</p>
                  </td>

                  {/* Status */}
                  <td className="hidden px-5 py-4 sm:table-cell">
                    <span className={cn(
                      "inline-flex items-center border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
                      STATUS_STYLE[deal.status].cls,
                    )}>
                      {STATUS_STYLE[deal.status].label}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {/* Toggle active/draft */}
                      <button
                        type="button"
                        onClick={() => toggleStatus(deal.id)}
                        aria-label={deal.status === "active" ? "Set to draft" : "Set to active"}
                        className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                        title={deal.status === "active" ? "Deactivate" : "Activate"}
                      >
                        {deal.status === "active"
                          ? <ToggleRight className="size-4 text-green-600" />
                          : <ToggleLeft className="size-4" />
                        }
                      </button>
                      <Link
                        href={`/admin/deals/${deal.id}/edit`}
                        className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="Edit deal"
                      >
                        <Edit2 className="size-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteId(deal.id)}
                        className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Delete deal"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-sm font-light text-muted-foreground">
                    No deals found.
                  </td>
                </tr>
              )}
              <tr className="admin-table-fill" aria-hidden="true">
                <td colSpan={5} />
              </tr>
            </tbody>
          </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-border md:hidden">
            {filtered.map(deal => (
              <div key={deal.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="relative size-12 shrink-0 overflow-hidden border border-border bg-muted">
                    {deal.image && deal.image !== "/product-bundle.png" ? (
                      <Image src={deal.image} alt="" fill className="object-cover" sizes="48px" />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-lavender">
                        <Tag className="size-4 text-gold/70" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium leading-snug">{deal.title}</p>
                      {deal.highlight && (
                        <span className="border border-gold/40 bg-lavender px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.15em] text-gold">
                          Featured
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-light text-muted-foreground">{deal.brand} · {deal.badge}</p>
                    <span className={cn(
                      "mt-2 inline-flex items-center border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
                      STATUS_STYLE[deal.status].cls,
                    )}>
                      {STATUS_STYLE[deal.status].label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">₦{deal.salePrice.toLocaleString()}</p>
                    <p className="text-xs font-light line-through text-muted-foreground">₦{deal.originalPrice.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleStatus(deal.id)}
                      aria-label={deal.status === "active" ? "Set to draft" : "Set to active"}
                      className="flex size-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {deal.status === "active"
                        ? <ToggleRight className="size-4 text-green-600" />
                        : <ToggleLeft className="size-4" />
                      }
                    </button>
                    <Link
                      href={`/admin/deals/${deal.id}/edit`}
                      className="flex size-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Edit deal"
                    >
                      <Edit2 className="size-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteId(deal.id)}
                      className="flex size-9 items-center justify-center text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Delete deal"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-16 text-center text-sm font-light text-muted-foreground">No deals found.</p>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Total Deals",    value: deals.length,                                color: "text-foreground" },
            { label: "Live on Site",   value: deals.filter(d => d.status === "active").length,   color: "text-green-600" },
            { label: "Draft / Hidden", value: deals.filter(d => d.status !== "active").length,   color: "text-amber-600" },
          ].map(card => (
            <div key={card.label} className="border border-border p-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{card.label}</p>
              <p className={cn("mt-2 font-serif text-3xl font-medium", card.color)}>{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm border border-border bg-background p-6 shadow-2xl">
            <h2 className="font-serif text-xl font-medium">Delete deal?</h2>
            <p className="mt-2 text-sm font-light text-muted-foreground">
              This action cannot be undone. The deal will be permanently removed from the catalogue.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-border py-2.5 text-xs font-medium uppercase tracking-[0.15em] transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(deleteId)}
                className="flex-1 bg-destructive py-2.5 text-xs font-medium uppercase tracking-[0.15em] text-white transition-opacity hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
