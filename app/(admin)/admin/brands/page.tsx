"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Search, Trash2, RefreshCw, ToggleLeft, ToggleRight, Check } from "lucide-react"
import {
  deleteBrand,
  getBrandsForAdmin,
  saveBrand,
  toggleBrandActive,
  type Brand,
} from "@/lib/supabase/brands"
import { revalidateBrands } from "@/app/actions/revalidate"
import { cn } from "@/lib/utils"
import { useAdminListParams, useAdminScrollRestore } from "@/components/admin-list-state"

/** Storefront brand pages cache for up to 1h; refresh them after a change (non-blocking). */
function refreshStorefrontBrands() {
  void revalidateBrands().then(r => {
    if (!r.ok) console.warn("[brands] storefront refresh skipped:", r.error)
  })
}

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  useAdminScrollRestore(!loading)
  const [query, setQuery] = useAdminListParams({ q: "" })
  const search = query.q
  const setSearch = (v: string) => setQuery({ q: v })
  const [name, setName] = useState("")
  const [tagline, setTagline] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setBrands(await getBrandsForAdmin())
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = brands.filter(b => {
    const q = search.toLowerCase()
    return !q || b.name.toLowerCase().includes(q) || b.tagline.toLowerCase().includes(q)
  })

  function startEdit(b: Brand) {
    setEditId(b.id)
    setName(b.name)
    setTagline(b.tagline)
    setError(null)
  }

  function resetForm() {
    setEditId(null)
    setName("")
    setTagline("")
    setError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Brand name is required.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveBrand({ id: editId ?? undefined, name, tagline })
      refreshStorefrontBrands()
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save brand.")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(b: Brand) {
    setBrands(prev => prev.map(x => (x.id === b.id ? { ...x, isActive: !x.isActive } : x)))
    try {
      await toggleBrandActive(b.id, !b.isActive)
      refreshStorefrontBrands()
    } catch {
      await load()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this brand? Products keeping the brand name text will still show it.")) return
    try {
      await deleteBrand(id)
      refreshStorefrontBrands()
      setBrands(prev => prev.filter(b => b.id !== id))
      if (editId === id) resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.")
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif text-2xl font-medium">Brands</h1>
          <p className="text-xs font-light text-muted-foreground mt-0.5">
            {loading ? "Loading…" : `${brands.length} brands — used on the product form & storefront`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex size-9 items-center justify-center border border-border text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="admin-page-body grid gap-8 lg:grid-cols-[340px_1fr]">
        <form onSubmit={handleSave} className="border border-border p-6 space-y-4 h-fit">
          <h2 className="text-xs font-medium uppercase tracking-[0.18em]">
            {editId ? "Edit brand" : "Add brand"}
          </h2>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Name *</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="input-field"
              placeholder="e.g. CeraVe"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Tagline</span>
            <input
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              className="input-field"
              placeholder="Short brand line"
            />
          </label>
          {error && <p className="text-sm font-light text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 bg-foreground px-4 py-2.5 text-xs font-medium uppercase tracking-[0.15em] text-background hover:bg-gold hover:text-gold-foreground disabled:opacity-60"
            >
              {saving ? "Saving…" : editId ? <><Check className="size-3.5" /> Update</> : <><Plus className="size-3.5" /> Add</>}
            </button>
            {editId && (
              <button
                type="button"
                onClick={resetForm}
                className="border border-border px-4 py-2.5 text-xs uppercase tracking-[0.12em]"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="flex min-h-0 flex-col">
          <div className="mb-4 relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search brands…"
              className="input-field pl-9"
            />
          </div>

          {loading ? (
            <div className="h-40 animate-pulse bg-muted/30" />
          ) : filtered.length === 0 ? (
            <p className="text-sm font-light text-muted-foreground py-12 text-center border border-dashed border-border">
              No brands yet. Add one to use on products.
            </p>
          ) : (
            <ul className="admin-table-panel border border-border divide-y divide-border">
              {filtered.map(b => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs font-light text-muted-foreground">{b.tagline || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleToggle(b)}
                      className="text-muted-foreground hover:text-foreground"
                      title={b.isActive ? "Deactivate" : "Activate"}
                    >
                      {b.isActive ? (
                        <ToggleRight className="size-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="size-5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(b)}
                      className="border border-border px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] hover:border-foreground"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(b.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${b.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
