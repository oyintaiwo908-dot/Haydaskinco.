"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Plus, Save, Search, Trash2, Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Deal, DealItem } from "@/lib/deals"
import { ALL_CONCERNS } from "@/lib/catalog"
import { getCatalogNames } from "@/lib/supabase/catalog"
import { getEffectivePrice, type Product } from "@/lib/products"
import { getActiveBrands, type Brand } from "@/lib/supabase/brands"
import { getAllProducts } from "@/lib/supabase/products"
import { saveDeal } from "@/lib/supabase/deals"
import { revalidateDeals } from "@/app/actions/revalidate"
import { TagPicker } from "@/components/tag-picker"

type ImageEntry = { preview: string; file?: File }

type BundleRow = DealItem & { _key: number }

type FormState = {
  title: string
  subtitle: string
  description: string
  discountPct: string
  highlight: boolean
  status: "active" | "draft"
  brandIds: string[]
  concerns: string[]
  image: ImageEntry | null
  items: BundleRow[]
}

let keyCounter = 0

function emptyRow(): BundleRow {
  return { _key: ++keyCounter, productId: "", variantLabel: null, name: "", size: "", price: 0 }
}

function toFormState(deal?: Deal): FormState {
  return {
    title: deal?.title ?? "",
    subtitle: deal?.subtitle ?? "",
    description: deal?.description ?? "",
    discountPct: deal?.discountPct ? String(deal.discountPct) : "",
    highlight: deal?.highlight ?? false,
    status: deal?.status === "active" ? "active" : "draft",
    brandIds: deal?.brandIds?.length ? deal.brandIds : [],
    concerns: deal?.concerns?.length
      ? deal.concerns
      : deal?.concern
        ? deal.concern.split(/\s*·\s*/).filter(Boolean)
        : [],
    image: deal?.image && deal.image !== "/product-bundle.png"
      ? { preview: deal.image }
      : null,
    items: deal?.items?.length
      ? deal.items.map(i => ({ ...i, _key: ++keyCounter }))
      : [emptyRow()],
  }
}

function Field({
  label, required, hint, children,
}: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">
        {label}{required && <span className="text-gold ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] font-light text-muted-foreground/70">{hint}</p>}
    </div>
  )
}

function unitPrice(product: Product, variantLabel?: string | null): number {
  if (variantLabel && product.variants?.length) {
    const v = product.variants.find(x => x.label === variantLabel)
    if (v) return v.price
  }
  return product.price
}

function sizeLabel(product: Product, variantLabel?: string | null): string {
  if (variantLabel) return variantLabel
  return product.size ?? ""
}

export function AdminDealForm({ deal }: { deal?: Deal }) {
  const router = useRouter()
  const isEdit = !!deal
  const [form, setForm] = useState<FormState>(() => toFormState(deal))
  const [brands, setBrands] = useState<Brand[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productQuery, setProductQuery] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [uploadError, setUploadError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [concernOptions, setConcernOptions] = useState<string[]>([...ALL_CONCERNS])

  useEffect(() => {
    getActiveBrands().then(setBrands)
    getAllProducts().then(setProducts)
    getCatalogNames("concerns").then(names => {
      if (names.length) setConcernOptions(names)
    })
  }, [])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  const originalPrice = useMemo(
    () => form.items.reduce((s, i) => s + (Number(i.price) || 0), 0),
    [form.items],
  )
  const discountPct = Math.min(100, Math.max(0, parseInt(form.discountPct, 10) || 0))
  const salePrice = getEffectivePrice({ price: originalPrice, discountPct })

  function toggleBrand(id: string) {
    setForm(f => ({
      ...f,
      brandIds: f.brandIds.includes(id)
        ? f.brandIds.filter(b => b !== id)
        : [...f.brandIds, id],
    }))
  }

  function setImageFile(file: File | null) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be under 5 MB.")
      return
    }
    setUploadError("")
    setForm(f => ({
      ...f,
      image: { preview: URL.createObjectURL(file), file },
    }))
  }

  function clearImage() {
    setForm(f => ({ ...f, image: null }))
  }

  function addItemRow() {
    setForm(f => ({ ...f, items: [...f.items, emptyRow()] }))
  }

  function removeItemRow(key: number) {
    setForm(f => ({
      ...f,
      items: f.items.length <= 1 ? f.items : f.items.filter(i => i._key !== key),
    }))
  }

  function selectProduct(key: number, product: Product, variantLabel?: string | null) {
    const label = variantLabel ?? (product.variants?.length === 1 ? product.variants[0].label : null)
    const price = unitPrice(product, label)
    const size = sizeLabel(product, label)
    const brandMatch = brands.find(b => b.name === product.brand)
    setForm(f => ({
      ...f,
      items: f.items.map(i =>
        i._key === key
          ? {
              ...i,
              productId: product.id,
              variantLabel: label,
              name: product.name,
              size,
              price,
            }
          : i,
      ),
      brandIds:
        brandMatch && !f.brandIds.includes(brandMatch.id)
          ? [...f.brandIds, brandMatch.id]
          : f.brandIds,
    }))
    setProductQuery(q => ({ ...q, [key]: "" }))
  }

  function setVariant(key: number, variantLabel: string) {
    const row = form.items.find(i => i._key === key)
    if (!row?.productId) return
    const product = products.find(p => p.id === row.productId)
    if (!product) return
    selectProduct(key, product, variantLabel)
  }

  function filteredProducts(key: number): Product[] {
    const q = (productQuery[key] ?? "").trim().toLowerCase()
    const selected = new Set(form.items.map(i => i.productId).filter(Boolean))
    return products
      .filter(p => {
        if (selected.has(p.id) && form.items.find(i => i._key === key)?.productId !== p.id) {
          return false
        }
        if (!q) return true
        return (
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
        )
      })
      .slice(0, 8)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError("")
    setUploadError("")

    if (!form.title.trim()) {
      setSaveError("Deal title is required.")
      return
    }
    if (!form.image) {
      setSaveError("Please upload a deal image.")
      return
    }
    if (form.items.some(i => !i.productId || !i.name)) {
      setSaveError("Select a product for every bundle line.")
      return
    }
    if (form.items.some(i => {
      const p = products.find(x => x.id === i.productId)
      return p?.variants && p.variants.length > 0 && !i.variantLabel
    })) {
      setSaveError("Choose a variant for every product that has variants.")
      return
    }
    if (!form.brandIds.length) {
      setSaveError("Select at least one brand.")
      return
    }
    if (originalPrice <= 0) {
      setSaveError("Bundle must include priced products.")
      return
    }

    setSaving(true)
    try {
      const slug =
        deal?.id ??
        form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

      let imageUrl = form.image.preview
      if (form.image.file) {
        const { uploadProductImage } = await import("@/lib/supabase/storage")
        imageUrl = await uploadProductImage(form.image.file, `deals/${slug}`)
      }

      const brandNames = brands
        .filter(b => form.brandIds.includes(b.id))
        .map(b => b.name)
      const brandLabel =
        brandNames.length > 1 ? brandNames.join(" · ") : (brandNames[0] ?? "")

      await saveDeal(
        {
          id: slug,
          title: form.title.trim(),
          subtitle: form.subtitle.trim(),
          description: form.description.trim(),
          image: imageUrl,
          brand: brandLabel,
          brandIds: form.brandIds,
          badge: discountPct > 0 ? `Save ${discountPct}%` : "",
          concerns: form.concerns,
          items: form.items.map(({ _key, ...i }) => i),
          discountPct,
          highlight: form.highlight,
          status: form.status,
        },
        deal?.id,
      )
      // Save already succeeded; a refused refresh only delays the storefront (≤1h ISR window).
      const refreshed = await revalidateDeals(slug)
      if (!refreshed.ok) console.warn("[deal] storefront refresh skipped:", refreshed.error)
      setSaved(true)
      setTimeout(() => router.push("/admin/deals"), 800)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-page">
      <div className="admin-page-header">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/deals"
            className="flex size-9 items-center justify-center border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-medium">
              {isEdit ? "Edit Deal" : "New Deal"}
            </h1>
            <p className="text-xs font-light text-muted-foreground mt-0.5">
              Bundle products with a combo discount — priced from your catalog
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving || saved}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.15em] transition-colors",
            saved
              ? "bg-green-700 text-white"
              : "bg-foreground text-background hover:bg-gold hover:text-gold-foreground disabled:opacity-50",
          )}
        >
          {saved ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
          {saved ? "Saved" : saving ? "Saving…" : "Save Deal"}
        </button>
      </div>

      <div className="admin-page-body grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="border border-border p-6 space-y-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.18em]">Details</h2>
            <Field label="Deal title" required>
              <input
                value={form.title}
                onChange={e => setField("title", e.target.value)}
                required
                placeholder="e.g. Barrier Repair Bundle"
                className="w-full border border-border bg-background px-4 py-3 text-sm font-light outline-none focus:border-foreground"
              />
            </Field>
            <Field label="Short subtitle" hint="Shown under the title on cards and the deal page">
              <input
                value={form.subtitle}
                onChange={e => setField("subtitle", e.target.value)}
                placeholder="Complete daily routine for dry & sensitive skin"
                className="w-full border border-border bg-background px-4 py-3 text-sm font-light outline-none focus:border-foreground"
              />
            </Field>
            <Field label="Product description" required hint="Full description on the deal detail page">
              <textarea
                value={form.description}
                onChange={e => setField("description", e.target.value)}
                required
                rows={5}
                placeholder="Describe what’s included and who it’s for…"
                className="w-full resize-y border border-border bg-background px-4 py-3 text-sm font-light outline-none focus:border-foreground"
              />
            </Field>
          </section>

          <section className="border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-[0.18em]">Bundle products</h2>
              <button
                type="button"
                onClick={addItemRow}
                className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-gold hover:underline"
              >
                <Plus className="size-3.5" /> Add product
              </button>
            </div>
            <p className="text-[11px] font-light text-muted-foreground">
              Select catalog products (and variants). Prices fill automatically and set the deal list price.
            </p>

            <div className="space-y-4">
              {form.items.map((row) => {
                const product = products.find(p => p.id === row.productId)
                const hasVariants = Boolean(product?.variants?.length)
                return (
                  <div key={row._key} className="border border-border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {row.productId ? (
                          <div>
                            <p className="text-sm font-medium">{row.name}</p>
                            <p className="text-[11px] font-light text-muted-foreground">
                              {product?.brand} · ₦{row.price.toLocaleString()}
                              {row.size ? ` · ${row.size}` : ""}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm font-light text-muted-foreground">No product selected</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItemRow(row._key)}
                        disabled={form.items.length <= 1}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                        aria-label="Remove line"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    {hasVariants && (
                      <Field label="Variant" required>
                        <select
                          value={row.variantLabel ?? ""}
                          onChange={e => setVariant(row._key, e.target.value)}
                          className="w-full border border-border bg-background px-4 py-2.5 text-sm font-light outline-none focus:border-foreground"
                        >
                          <option value="">Select variant…</option>
                          {product!.variants!.map(v => (
                            <option key={v.label} value={v.label}>
                              {v.label} — ₦{v.price.toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <input
                        type="search"
                        value={productQuery[row._key] ?? ""}
                        onChange={e => setProductQuery(q => ({ ...q, [row._key]: e.target.value }))}
                        placeholder={row.productId ? "Replace product…" : "Search products…"}
                        className="w-full border border-border bg-background py-2.5 pl-9 pr-3 text-sm font-light outline-none focus:border-foreground"
                      />
                      {(productQuery[row._key] ?? "").trim() && (
                        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto border border-border bg-background shadow-md">
                          {filteredProducts(row._key).map(p => (
                            <li key={p.id}>
                              <button
                                type="button"
                                onClick={() => selectProduct(row._key, p)}
                                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">{p.name}</span>
                                  <span className="block text-[11px] font-light text-muted-foreground">
                                    {p.brand}
                                    {p.variants?.length ? ` · ${p.variants.length} variants` : ""}
                                  </span>
                                </span>
                                <span className="shrink-0 text-xs font-light">
                                  ₦{p.price.toLocaleString()}
                                </span>
                              </button>
                            </li>
                          ))}
                          {!filteredProducts(row._key).length && (
                            <li className="px-3 py-2.5 text-xs font-light text-muted-foreground">
                              No products match
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="border border-border p-6 space-y-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.18em]">Brands</h2>
            <p className="text-[11px] font-light text-muted-foreground">
              Select one or more brands for this combo (multi-brand kits supported).
            </p>
            <div className="flex flex-wrap gap-2">
              {brands.map(b => {
                const on = form.brandIds.includes(b.id)
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBrand(b.id)}
                    className={cn(
                      "border px-3 py-1.5 text-xs font-light transition-colors",
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground",
                    )}
                  >
                    {b.name}
                  </button>
                )
              })}
              {!brands.length && (
                <p className="text-xs text-muted-foreground">No brands found. Add brands in Admin → Brands.</p>
              )}
            </div>
          </section>

          <section className="border border-border p-6">
            <TagPicker
              label="Concerns"
              hint="Search pinned concerns or add a custom one."
              options={concernOptions}
              value={form.concerns}
              onChange={concerns => setForm(f => ({ ...f, concerns }))}
              placeholder="Search concerns…"
            />
          </section>
        </div>

        <div className="space-y-6">
          <section className="border border-border p-6 space-y-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.18em]">Deal image</h2>
            {form.image ? (
              <div className="relative aspect-square overflow-hidden border border-border bg-muted">
                <Image src={form.image.preview} alt="Deal" fill className="object-cover" sizes="320px" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute right-2 top-2 flex size-8 items-center justify-center bg-background/90 border border-border hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOver(false)
                  setImageFile(e.dataTransfer.files?.[0] ?? null)
                }}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 border border-dashed transition-colors",
                  dragOver ? "border-gold bg-lavender" : "border-border hover:border-foreground",
                )}
              >
                <Upload className="size-6 text-muted-foreground" />
                <p className="text-xs font-light text-muted-foreground text-center px-4">
                  Drop image or click to upload
                </p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => setImageFile(e.target.files?.[0] ?? null)}
            />
            {uploadError && (
              <p className="text-xs text-destructive">{uploadError}</p>
            )}
          </section>

          <section className="border border-border p-6 space-y-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.18em]">Pricing</h2>
            <div className="space-y-1">
              <p className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">
                List price (from products)
              </p>
              <p className="font-serif text-2xl font-medium">₦{originalPrice.toLocaleString()}</p>
            </div>
            <Field
              label="Discount (%)"
              hint="0–100. Storefront shows list price struck through and the discounted price."
            >
              <input
                type="number"
                value={form.discountPct}
                onChange={e => {
                  const n = e.target.value
                  if (n === "") {
                    setField("discountPct", "")
                    return
                  }
                  setField("discountPct", String(Math.min(100, Math.max(0, parseInt(n, 10) || 0))))
                }}
                placeholder="0"
                min={0}
                max={100}
                className="w-full border border-border bg-background px-4 py-3 text-sm font-light outline-none focus:border-foreground"
              />
            </Field>
            {discountPct > 0 && (
              <div className="flex items-baseline gap-2 border border-gold/30 bg-lavender px-3 py-2">
                <span className="font-serif text-xl font-medium">₦{salePrice.toLocaleString()}</span>
                <span className="text-xs text-gold">-{discountPct}%</span>
              </div>
            )}
          </section>

          <section className="border border-border p-6 space-y-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.18em]">Status</h2>
            <div className="flex gap-2">
              {(["draft", "active"] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setField("status", s)}
                  className={cn(
                    "flex-1 border px-3 py-2.5 text-xs font-medium uppercase tracking-[0.12em] transition-colors",
                    form.status === s
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.highlight}
                onChange={e => setField("highlight", e.target.checked)}
                className="size-4 accent-foreground"
              />
              <span className="text-sm font-light">Featured deal</span>
            </label>
          </section>

          {saveError && (
            <p className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {saveError}
            </p>
          )}
        </div>
      </div>
    </form>
  )
}
