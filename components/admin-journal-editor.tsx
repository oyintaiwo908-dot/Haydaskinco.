"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Save, Eye, Upload, Trash2, Plus, X,
  Bold, Italic, Heading2, List, Quote, Minus
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Journal } from "@/lib/journals"
import { saveJournal } from "@/lib/supabase/journals"
import { uploadProductImage } from "@/lib/supabase/storage"
import { revalidateJournal } from "@/app/actions/revalidate"

type FormState = {
  title: string
  excerpt: string
  content: string
  category: string
  author: string
  publishedAt: string
  image: string
  readTime: string
  status: "published" | "draft"
  tags: string[]
}

const CATEGORIES = ["Rituals", "Ingredients", "Skin Science", "Lifestyle", "Sustainability", "Behind the Brand"]

function toFormState(journal?: Journal): FormState {
  return {
    title: journal?.title ?? "",
    excerpt: journal?.excerpt ?? "",
    content: journal?.content ?? "",
    category: journal?.category ?? "Rituals",
    author: journal?.author ?? "HAYDA Editorial",
    publishedAt: journal?.publishedAt ?? new Date().toISOString().split("T")[0],
    image: journal?.image ?? "",
    readTime: journal ? String(journal.readTime) : "5",
    status: journal?.status ?? "draft",
    tags: journal?.tags ?? [],
  }
}

export function AdminJournalEditor({ journal }: { journal?: Journal }) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(toFormState(journal))
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(journal?.image ?? null)
  const [dragOver, setDragOver] = useState(false)
  const [newTag, setNewTag] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isEdit = !!journal

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const [imageFile, setImageFile] = useState<File | null>(null)

  function handleImageFile(file: File) {
    const url = URL.createObjectURL(file)
    setImagePreview(url)
    setImageFile(file)
    setForm((f) => ({ ...f, image: url }))
  }

  function insertMarkdown(before: string, after = "") {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = form.content.slice(start, end)
    const newContent =
      form.content.slice(0, start) + before + selected + after + form.content.slice(end)
    setForm((f) => ({ ...f, content: newContent }))
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + before.length, start + before.length + selected.length)
    }, 0)
  }

  function addTag() {
    const tag = newTag.trim().toLowerCase()
    if (tag && !form.tags.includes(tag)) {
      setForm((f) => ({ ...f, tags: [...f.tags, tag] }))
    }
    setNewTag("")
  }

  function removeTag(tag: string) {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))
  }

  async function handleSave(status: "published" | "draft") {
    setSaving(true)
    try {
      let coverUrl = form.image

      // Upload new cover image to Supabase Storage if a file was selected
      if (imageFile) {
        const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "journal"
        coverUrl = await uploadProductImage(imageFile, `journals/${slug}`)
      }

      const slug =
        form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") ||
        journal?.slug

      await saveJournal(
        { ...form, slug, image: coverUrl, status, readTime: Number(form.readTime) || 5 },
        journal?.id,
      )
      // Save already succeeded; a refused refresh only delays the storefront (≤1h ISR window).
      const refreshed = await revalidateJournal(slug)
      if (!refreshed.ok) console.warn("[journal] storefront refresh skipped:", refreshed.error)
      router.push("/admin/journals")
    } catch (err) {
      console.error("Save failed:", err)
      setSaving(false)
    }
  }

  /* ── Markdown preview renderer ── */
  function formatInline(text: string): string {
    // Escape HTML first so user content can't inject tags
    let s = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")

    // Bold (**text**) then italic (*text*) — no lookbehind (Safari-safe)
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    s = s.replace(/\*([^*]+)\*/g, '<em class="italic text-foreground/90">$1</em>')
    s = s.replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">$1</code>')
    return s
  }

  function renderPreview(md: string): string {
    if (!md.trim()) {
      return '<p class="text-sm text-muted-foreground/50 italic">Nothing to preview yet — start writing above.</p>'
    }

    const lines = md.split("\n")
    const html: string[] = []
    let inList = false

    for (const raw of lines) {
      // Detect block type from the raw line BEFORE inline formatting
      if (raw.startsWith("## ")) {
        if (inList) { html.push("</ul>"); inList = false }
        html.push(`<h2 class="font-serif text-2xl font-medium mt-8 mb-3 text-foreground">${formatInline(raw.slice(3))}</h2>`)
      } else if (raw.startsWith("### ")) {
        if (inList) { html.push("</ul>"); inList = false }
        html.push(`<h3 class="font-serif text-lg font-medium mt-6 mb-2 text-foreground">${formatInline(raw.slice(4))}</h3>`)
      } else if (raw.startsWith("> ")) {
        if (inList) { html.push("</ul>"); inList = false }
        html.push(`<blockquote class="border-l-2 border-gold pl-5 py-0.5 my-4 font-serif italic text-muted-foreground">${formatInline(raw.slice(2))}</blockquote>`)
      } else if (raw.startsWith("- ") || raw.startsWith("* ")) {
        if (!inList) { html.push('<ul class="my-3 list-none space-y-1.5">'); inList = true }
        html.push(
          `<li class="flex gap-2.5 text-base leading-[1.8] text-muted-foreground"><span class="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold"></span><span>${formatInline(raw.slice(2))}</span></li>`,
        )
      } else if (/^---+$/.test(raw.trim())) {
        if (inList) { html.push("</ul>"); inList = false }
        html.push('<hr class="my-8 border-border" />')
      } else if (raw.trim() === "") {
        if (inList) { html.push("</ul>"); inList = false }
        html.push('<div class="h-3"></div>')
      } else {
        if (inList) { html.push("</ul>"); inList = false }
        // Use font-normal so nested strong/em weights are visible
        html.push(`<p class="mb-1 text-base font-normal leading-[1.9] text-muted-foreground">${formatInline(raw)}</p>`)
      }
    }

    if (inList) html.push("</ul>")
    return html.join("\n")
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-page-header">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex shrink-0 items-center gap-1.5 text-xs font-light text-muted-foreground hover:text-foreground transition-colors uppercase tracking-[0.15em]"
          >
            <ArrowLeft className="size-3.5" /> Journal
          </button>
          <span className="hidden text-border sm:inline">/</span>
          <h1 className="font-serif text-lg font-medium sm:text-xl">
            {isEdit ? "Edit Article" : "Write Article"}
          </h1>
          {form.status === "draft" && (
            <span className="border border-border px-2 py-0.5 text-[10px] font-light uppercase tracking-[0.12em] text-muted-foreground">
              Draft
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className={cn(
              "flex items-center gap-2 border px-4 py-2 text-xs font-light uppercase tracking-[0.15em] transition-colors",
              preview ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground",
            )}
          >
            <Eye className="size-3.5" /> {preview ? "Edit" : "Preview"}
          </button>
          <button
            type="button"
            onClick={() => handleSave("draft")}
            disabled={saving}
            className="border border-border px-4 py-2 text-xs font-light uppercase tracking-[0.15em] hover:border-foreground transition-colors disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSave("published")}
            disabled={saving}
            className={cn(
              "flex items-center gap-2 px-5 py-2 text-xs font-medium uppercase tracking-[0.15em] transition-all",
              saving
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-foreground text-background hover:bg-gold hover:text-gold-foreground",
            )}
          >
            {saving ? (
              <span className="size-3.5 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Publish
          </button>
        </div>
      </div>

      <div className="admin-page-body">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
          {/* Main editor */}
          <div className="space-y-5">
            {/* Title */}
            <input
              type="text"
              value={form.title}
              onChange={set("title")}
              placeholder="Article title…"
              className="w-full border-0 border-b border-border bg-transparent pb-4 font-serif text-3xl font-medium outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors"
            />

            {/* Excerpt */}
            <textarea
              value={form.excerpt}
              onChange={set("excerpt")}
              placeholder="Write a brief excerpt that appears in listings…"
              rows={2}
              className="w-full resize-none border-0 border-b border-border bg-transparent pb-4 text-sm font-light text-muted-foreground outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors"
            />

            {/* Toolbar + Editor */}
            <div className="border border-border">
              {/* Markdown toolbar */}
              {!preview && (
                <div className="flex items-center gap-0.5 border-b border-border bg-secondary px-3 py-2">
                  <ToolbarBtn onClick={() => insertMarkdown("**", "**")} title="Bold">
                    <Bold className="size-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => insertMarkdown("*", "*")} title="Italic">
                    <Italic className="size-3.5" />
                  </ToolbarBtn>
                  <Divider />
                  <ToolbarBtn onClick={() => insertMarkdown("## ")} title="Heading">
                    <Heading2 className="size-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => insertMarkdown("- ")} title="List item">
                    <List className="size-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => insertMarkdown("> ")} title="Quote">
                    <Quote className="size-3.5" />
                  </ToolbarBtn>
                  <Divider />
                  <ToolbarBtn onClick={() => insertMarkdown("\n---\n")} title="Divider">
                    <Minus className="size-3.5" />
                  </ToolbarBtn>
                  <span className="ml-auto text-[10px] font-light text-muted-foreground">Markdown supported</span>
                </div>
              )}

              {preview ? (
                <div
                  className="min-h-96 p-6 [&_strong]:font-semibold [&_em]:italic"
                  dangerouslySetInnerHTML={{ __html: renderPreview(form.content) }}
                />
              ) : (
                <textarea
                  ref={textareaRef}
                  value={form.content}
                  onChange={set("content")}
                  placeholder="Write your article here… Markdown is supported.

## Start with a heading

Use **bold** or *italic* for emphasis.

> Add a blockquote for notable quotes.

- Use bullet points for lists"
                  className="min-h-96 w-full resize-y bg-transparent p-6 font-mono text-sm font-light leading-relaxed outline-none placeholder:text-muted-foreground"
                />
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Cover image */}
            <section className="border border-border p-5">
              <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em]">Cover Image</h3>
              {imagePreview ? (
                <div className="relative aspect-video overflow-hidden border border-border bg-muted mb-3">
                  <Image src={imagePreview} alt="Cover" fill sizes="300px" className="object-cover" />
                  <button
                    type="button"
                    onClick={() => { setImagePreview(null); setForm((f) => ({ ...f, image: "" })) }}
                    className="absolute right-2 top-2 flex size-6 items-center justify-center bg-background/90 text-foreground hover:bg-destructive hover:text-background transition-colors"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ) : (
                <div
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleImageFile(f) }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    "mb-3 flex aspect-video cursor-pointer flex-col items-center justify-center border-2 border-dashed transition-colors",
                    dragOver ? "border-gold bg-lavender" : "border-border hover:border-foreground/50",
                  )}
                >
                  <Upload className="size-6 text-muted-foreground mb-2" />
                  <p className="text-[10px] font-light text-muted-foreground">Drop or click to upload</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }} />
              <button type="button" onClick={() => fileRef.current?.click()} className="w-full border border-border py-2 text-[11px] font-light uppercase tracking-[0.12em] hover:border-foreground transition-colors">
                {imagePreview ? "Change" : "Upload"} Image
              </button>
            </section>

            {/* Metadata */}
            <section className="border border-border p-5 space-y-4">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.18em]">Article Details</h3>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-light uppercase tracking-[0.15em] text-muted-foreground">Category</label>
                <select value={form.category} onChange={set("category")} className="input-field text-sm py-2">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-light uppercase tracking-[0.15em] text-muted-foreground">Author</label>
                <input type="text" value={form.author} onChange={set("author")} className="input-field text-sm py-2" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-light uppercase tracking-[0.15em] text-muted-foreground">Publish Date</label>
                  <input type="date" value={form.publishedAt} onChange={set("publishedAt")} className="input-field text-sm py-2" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-light uppercase tracking-[0.15em] text-muted-foreground">Read Time (min)</label>
                  <input type="number" value={form.readTime} onChange={set("readTime")} min="1" className="input-field text-sm py-2" />
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-light uppercase tracking-[0.15em] text-muted-foreground">Tags</label>
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  {form.tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 border border-border bg-muted px-2 py-0.5 text-[10px] font-light">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="text-muted-foreground hover:text-destructive">
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
                    placeholder="Add tag…"
                    className="input-field flex-1 py-2 text-sm"
                  />
                  <button type="button" onClick={addTag} className="border border-border px-3 hover:border-foreground transition-colors">
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolbarBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="mx-1 h-4 w-px bg-border" />
}
