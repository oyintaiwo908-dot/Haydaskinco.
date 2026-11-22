"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Search, Edit2, Trash2, Eye, Package, RefreshCw, Archive, ArchiveRestore, SlidersHorizontal } from "lucide-react"
import { formatPrice, productTags, type Product } from "@/lib/products"
import { getAdminProductsPage, deleteProduct, setProductArchived } from "@/lib/supabase/products"
import { getCategoryTree } from "@/lib/supabase/categories"
import { AdminPagination, ADMIN_PAGE_SIZE } from "@/components/admin-pagination"
import { useAdminListParams, useAdminScrollRestore } from "@/components/admin-list-state"
import { AdminProductQuickEdit } from "@/components/admin-product-quick-edit"
import { cn } from "@/lib/utils"

function productListImage(image: string | undefined) {
  const src = image?.trim()
  if (!src || src === "/placeholder.svg") return null
  return src
}

function ProductRowThumb({ image }: { image: string }) {
  const src = productListImage(image)
  return (
    <div className="relative size-10 shrink-0 overflow-hidden border border-border bg-white">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-contain" />
      ) : null}
    </div>
  )
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  // Page, search, filters live in the URL so returning from an edit reopens the same view.
  const [query, setQuery] = useAdminListParams({ q: "", category: "All", archive: "active", page: "1" })
  const searchDebounced = query.q
  const categoryFilter = query.category
  const archiveFilter = query.archive as "active" | "archived" | "all"
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const [search, setSearch] = useState(query.q)
  const [categoryOptions, setCategoryOptions] = useState<string[]>(["All"])
  const [quickEdit, setQuickEdit] = useState<Product | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; action: "delete" | "archive" | "restore" } | null>(null)
  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Filter changes go back to page 1 (in the same URL write).
  const setCategoryFilter = (v: string) => setQuery({ category: v, page: "1" })
  const setArchiveFilter = (v: "active" | "archived" | "all") => setQuery({ archive: v, page: "1" })
  const setPage = (n: number) => setQuery({ page: String(n) })

  useEffect(() => {
    if (search === query.q) return
    const t = setTimeout(() => setQuery({ q: search, page: "1" }), 300)
    return () => clearTimeout(t)
  }, [search, query.q, setQuery])

  useEffect(() => {
    getCategoryTree().then(tree => {
      const names = tree.flatMap(s => s.categories.map(c => c.name))
      setCategoryOptions(["All", ...names])
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const { products: rows, total: count } = await getAdminProductsPage({
      search: searchDebounced,
      category: categoryFilter,
      archive: archiveFilter,
      page,
      pageSize: ADMIN_PAGE_SIZE,
    })
    setProducts(rows)
    setTotal(count)
    setLoading(false)
  }, [searchDebounced, categoryFilter, archiveFilter, page])

  useEffect(() => { void load() }, [load])
  useAdminScrollRestore(!loading)

  function applyQuickEdit(id: string, values: { discountPct: number; stock: number }) {
    setProducts(prev => prev.map(p => (p.id === id ? { ...p, discountPct: values.discountPct, stock: values.stock } : p)))
  }

  async function confirmAction() {
    if (!confirm) return
    setWorking(true)
    setActionError(null)
    try {
      if (confirm.action === "delete") {
        await deleteProduct(confirm.id)
      } else {
        await setProductArchived(confirm.id, confirm.action === "archive")
      }
      // Deletes refresh too: catalogue pages now cache for up to 1h.
      const { revalidateProducts } = await import("@/app/actions/revalidate")
      const refreshed = await revalidateProducts(confirm.id)
      if (!refreshed.ok) console.warn("[product] storefront refresh skipped:", refreshed.error)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update this product.")
    }
    setWorking(false)
    setConfirm(null)
  }

  function stockLabel(stock: number) {
    if (stock === 0) return { label: "Out of Stock", className: "text-destructive", dot: "bg-destructive" }
    if (stock <= 5) return { label: "Low Stock", className: "text-amber-600", dot: "bg-amber-500" }
    return { label: "In Stock", className: "text-green-700", dot: "bg-green-500" }
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif text-2xl font-medium">Products</h1>
          <p className="text-xs font-light text-muted-foreground mt-0.5">
            {loading ? "Loading…" : `${total} product${total !== 1 ? "s" : ""} in catalogue`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh"
            className="flex size-9 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
          <Link
            href="/admin/products/new"
            className="flex items-center gap-2 bg-foreground px-5 py-2.5 text-xs font-medium uppercase tracking-[0.15em] text-background transition-colors hover:bg-gold hover:text-gold-foreground"
          >
            <Plus className="size-3.5" /> Add Product
          </Link>
        </div>
      </div>

      <div className="admin-page-body">
        {actionError && (
          <p className="mb-4 border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-light text-destructive">
            {actionError}
          </p>
        )}
        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by name, brand, category…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-border bg-background py-2.5 pl-10 pr-4 text-sm font-light outline-none focus:border-foreground transition-colors"
            />
          </div>
          <select
            value={archiveFilter}
            onChange={e => setArchiveFilter(e.target.value as "active" | "archived" | "all")}
            className="border border-border bg-background px-3 py-2.5 text-xs font-light outline-none focus:border-foreground"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All products</option>
          </select>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="border border-border bg-background px-3 py-2.5 text-xs font-light outline-none focus:border-foreground max-w-xs"
          >
            {categoryOptions.map(cat => (
              <option key={cat} value={cat}>{cat === "All" ? "All categories" : cat}</option>
            ))}
          </select>
        </div>

        {/* Loading skeleton */}
        {loading ? (
            <div className="admin-table-panel border border-border divide-y divide-border">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                <div className="size-10 shrink-0 bg-secondary animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-48 bg-muted/50 animate-pulse" />
                  <div className="h-2.5 w-32 bg-muted/30 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="admin-table-panel flex flex-col items-center justify-center py-20 text-center border border-dashed border-border">
            <Package className="size-10 text-muted-foreground mb-3" />
            <p className="font-serif text-lg font-medium">No products found</p>
            <p className="mt-1 text-sm font-light text-muted-foreground">
              {search || categoryFilter !== "All" || archiveFilter !== "active" ? "Try adjusting your search or filters." : "Add your first product to get started."}
            </p>
          </div>
        ) : (
          <div className="admin-table-panel border border-border">
            {/* Desktop table */}
            <div className="admin-table-scroll hidden md:block">
              <table className="admin-data-table w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary">
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Product</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Category</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Price</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Tag</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Stock</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map(product => {
                    const stock = stockLabel(product.stock)
                    return (
                      <tr key={product.id} className="hover:bg-secondary transition-colors">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2.5">
                            <ProductRowThumb image={product.image} />
                            <div className="min-w-0">
                              <p className="max-w-[16rem] truncate text-sm font-medium leading-tight" title={product.name}>{product.name}</p>
                              <p className="max-w-[16rem] truncate text-xs font-light text-muted-foreground">{product.brand}</p>
                              {product.archived && (
                                <span className="mt-1 inline-block border border-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                  Archived
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-light text-muted-foreground">{product.category}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-sm font-medium">{formatPrice(product.price)}</span>
                          {product.discountPct ? (
                            <span className="ml-1.5 text-[10px] font-medium text-destructive">−{product.discountPct}%</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          {productTags(product).length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {productTags(product).map(t => (
                                <span
                                  key={t}
                                  className={cn(
                                    "border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
                                    t === "Bestseller"
                                      ? "border-gold/40 bg-lavender text-gold"
                                      : t === "Sale"
                                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                                        : "border-border text-muted-foreground",
                                  )}
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn("flex items-center gap-1.5 whitespace-nowrap text-[10px] font-medium", stock.className)}>
                            <span className={cn("size-1.5 rounded-full", stock.dot)} />
                            {stock.label}
                            <span className="text-muted-foreground font-light">({product.stock})</span>
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/product/${product.id}`}
                              target="_blank"
                              className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="View on storefront"
                            >
                              <Eye className="size-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => setQuickEdit(product)}
                              className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                              aria-label={`Quick edit discount and stock for ${product.name}`}
                            >
                              <SlidersHorizontal className="size-4" />
                            </button>
                            <Link
                              href={`/admin/products/${product.id}/edit`}
                              className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="Edit product"
                            >
                              <Edit2 className="size-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => setConfirm({ id: product.id, action: product.archived ? "restore" : "archive" })}
                              className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                              aria-label={product.archived ? "Restore product" : "Archive product"}
                            >
                              {product.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirm({ id: product.id, action: "delete" })}
                              className="flex size-8 items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                              aria-label="Delete product"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="admin-table-fill" aria-hidden="true">
                    <td colSpan={6} />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-border md:hidden">
              {products.map(product => {
                const stock = stockLabel(product.stock)
                return (
                  <div key={product.id} className="flex items-center gap-2.5 px-3 py-2">
                    <ProductRowThumb image={product.image} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      {product.archived && (
                        <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Archived</span>
                      )}
                      <p className="text-xs font-light text-muted-foreground">{product.category}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm font-medium">{formatPrice(product.price)}</p>
                        <span className={cn("text-[10px] font-medium", stock.className)}>{stock.label}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQuickEdit(product)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Quick edit discount and stock for ${product.name}`}
                      >
                        <SlidersHorizontal className="size-4" />
                      </button>
                      <Link href={`/admin/products/${product.id}/edit`} className="text-muted-foreground hover:text-foreground" aria-label="Edit product">
                        <Edit2 className="size-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setConfirm({ id: product.id, action: product.archived ? "restore" : "archive" })}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={product.archived ? "Restore product" : "Archive product"}
                      >
                        {product.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                      </button>
                      <button type="button" onClick={() => setConfirm({ id: product.id, action: "delete" })} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <AdminPagination
          page={page}
          pageSize={ADMIN_PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          className="mt-6"
        />
      </div>

      <AdminProductQuickEdit product={quickEdit} onClose={() => setQuickEdit(null)} onSaved={applyQuickEdit} />

      {/* Delete confirmation modal */}
      {confirm && (
        <>
          <div className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]" onClick={() => !working && setConfirm(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 bg-background border border-border p-6 shadow-2xl">
            <h3 className="font-serif text-xl font-medium mb-2">
              {confirm.action === "delete" ? "Delete Product" : confirm.action === "archive" ? "Archive Product" : "Restore Product"}
            </h3>
            <p className="text-sm font-light text-muted-foreground mb-6">
              {confirm.action === "delete" ? (
                <>
                  Are you sure you want to delete{" "}
                  <span className="font-medium text-foreground">
                    {products.find(p => p.id === confirm.id)?.name}
                  </span>
                  ? This action cannot be undone.
                </>
              ) : confirm.action === "archive" ? (
                <>
                  Archive{" "}
                  <span className="font-medium text-foreground">
                    {products.find(p => p.id === confirm.id)?.name}
                  </span>
                  ? It will be hidden from the store and can be restored later.
                </>
              ) : (
                <>
                  Restore{" "}
                  <span className="font-medium text-foreground">
                    {products.find(p => p.id === confirm.id)?.name}
                  </span>
                  {" "}to the store?
                </>
              )}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={working}
                className="flex-1 border border-border py-3 text-xs font-medium uppercase tracking-[0.15em] hover:border-foreground transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmAction()}
                disabled={working}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 py-3 text-xs font-medium uppercase tracking-[0.15em] text-background transition-opacity disabled:opacity-60",
                  confirm.action === "delete" ? "bg-destructive hover:opacity-90" : "bg-foreground hover:bg-gold hover:text-gold-foreground",
                )}
              >
                {working ? (
                  <><span className="size-3.5 rounded-full border-2 border-background/30 border-t-background animate-spin" /> Working…</>
                ) : confirm.action === "delete" ? "Delete" : confirm.action === "archive" ? "Archive" : "Restore"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
