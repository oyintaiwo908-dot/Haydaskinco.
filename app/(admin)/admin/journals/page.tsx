"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { Plus, Search, Edit2, Trash2, Eye, Clock, BookOpen, RefreshCw } from "lucide-react"
import { type Journal } from "@/lib/journals"
import { getAllJournals, deleteJournal } from "@/lib/supabase/journals"
import { revalidateJournal } from "@/app/actions/revalidate"
import { cn } from "@/lib/utils"

export default function AdminJournalsPage() {
  const [articles, setArticles] = useState<Journal[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getAllJournals()
    setArticles(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filtered = articles.filter((a) => {
    const matchSearch =
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase()) ||
      a.author.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "all" || a.status === statusFilter
    return matchSearch && matchStatus
  })

  async function confirmDelete(id: string) {
    try { await deleteJournal(id) } catch { /* fall through */ }
    // Storefront journal pages cache for up to 1h; refresh them (non-blocking).
    const slug = articles.find(a => a.id === id)?.slug
    void revalidateJournal(slug).then(r => {
      if (!r.ok) console.warn("[journal] storefront refresh skipped:", r.error)
    })
    setArticles((prev) => prev.filter((a) => a.id !== id))
    setDeleteId(null)
  }

  const published = articles.filter((a) => a.status === "published").length
  const drafts = articles.filter((a) => a.status === "draft").length

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif text-2xl font-medium">Journal</h1>
          <p className="text-xs font-light text-muted-foreground mt-0.5">
            {loading ? "Loading…" : `${published} published · ${drafts} draft${drafts !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            href="/admin/journals/new"
            className="flex items-center gap-2 bg-foreground px-5 py-2.5 text-xs font-medium uppercase tracking-[0.15em] text-background transition-colors hover:bg-gold hover:text-gold-foreground"
          >
            <Plus className="size-3.5" /> Write Article
          </Link>
        </div>
      </div>

      <div className="admin-page-body">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            { label: "Total Articles", value: articles.length },
            { label: "Published", value: published },
            { label: "Drafts", value: drafts },
          ].map((stat) => (
            <div key={stat.label} className="border border-border p-4 text-center">
              <p className="font-serif text-2xl font-medium">{stat.value}</p>
              <p className="mt-0.5 text-[10px] font-light uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search articles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-border bg-background py-2.5 pl-10 pr-4 text-sm font-light outline-none focus:border-foreground transition-colors"
            />
          </div>
          <div className="flex gap-1.5">
            {(["all", "published", "draft"] as const).map((s) => (
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
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border border-border overflow-hidden">
                <div className="aspect-video bg-muted/50 animate-pulse" />
                <div className="p-5 space-y-2">
                  <div className="h-3 w-24 bg-muted/50 animate-pulse" />
                  <div className="h-5 w-full bg-muted/50 animate-pulse" />
                  <div className="h-3 w-48 bg-muted/30 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Articles */}
        {!loading && filtered.length === 0 ? (
          <div className="admin-table-panel flex flex-col items-center justify-center py-20 text-center border border-dashed border-border">
            <BookOpen className="size-10 text-muted-foreground mb-3" />
            <p className="font-serif text-lg font-medium">No articles found</p>
            <p className="mt-1 text-sm font-light text-muted-foreground">Try adjusting your search or write a new article.</p>
          </div>
        ) : !loading && (
          <div className="admin-table-panel grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((article) => (
              <div key={article.id} className="group border border-border bg-card flex flex-col overflow-hidden">
                {/* Image */}
                <div className="relative aspect-video overflow-hidden bg-muted">
                  <Image
                    src={article.image || "/placeholder.svg"}
                    alt={article.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className={cn(
                    "absolute right-3 top-3 border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em]",
                    article.status === "published"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-border bg-background text-muted-foreground",
                  )}>
                    {article.status}
                  </span>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-light uppercase tracking-[0.18em] text-gold">{article.category}</span>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1 text-[10px] font-light text-muted-foreground">
                      <Clock className="size-2.5" /> {article.readTime} min read
                    </span>
                  </div>
                  <h3 className="font-serif text-lg font-medium leading-snug mb-2 flex-1">
                    {article.title}
                  </h3>
                  <p className="text-xs font-light text-muted-foreground line-clamp-2 mb-4">
                    {article.excerpt}
                  </p>
                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <div>
                      <p className="text-xs font-medium">{article.author}</p>
                      <p className="text-[10px] font-light text-muted-foreground">
                        {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/journal`}
                        target="_blank"
                        className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Preview"
                      >
                        <Eye className="size-4" />
                      </Link>
                      <Link
                        href={`/admin/journals/${article.id}/edit`}
                        className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Edit"
                      >
                        <Edit2 className="size-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteId(article.id)}
                        className="flex size-8 items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Delete"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteId && (
        <>
          <div className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]" onClick={() => setDeleteId(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 bg-background border border-border p-6 shadow-2xl">
            <h3 className="font-serif text-xl font-medium mb-2">Delete Article</h3>
            <p className="text-sm font-light text-muted-foreground mb-6">
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                &ldquo;{articles.find((a) => a.id === deleteId)?.title}&rdquo;
              </span>
              ? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteId(null)} className="flex-1 border border-border py-3 text-xs font-medium uppercase tracking-[0.15em] hover:border-foreground transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => confirmDelete(deleteId)} className="flex-1 bg-destructive py-3 text-xs font-medium uppercase tracking-[0.15em] text-background hover:opacity-90 transition-opacity">
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
