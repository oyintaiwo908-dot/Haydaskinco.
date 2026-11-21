"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Upload, X, Plus, ArrowLeft, Save, Trash2, GripVertical, Check, Archive, ArchiveRestore } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Product, ProductTag } from "@/lib/products"
import { PRODUCT_TAGS, productTags } from "@/lib/products"
import { ALL_SKIN_TYPES } from "@/lib/catalog"
import { getCatalogNames } from "@/lib/supabase/catalog"
import { setProductArchived } from "@/lib/supabase/products"
import { getActiveBrands, type Brand } from "@/lib/supabase/brands"
import { getCategoryTree, type CategorySection } from "@/lib/supabase/categories"
import { CategoryMultiSelect } from "@/components/category-multi-select"
import { TagPicker } from "@/components/tag-picker"
import { AdminProductPreview } from "@/components/admin-product-preview"

/* ─── Form types ─────────────────────────────────────────────── */
type VariantRow = { label: string; price: string }
type TierRow = { qty: string; value: string }

/**
 * An image entry in the form.
 * - `preview`  — always set: a blob URL (new file) or a real storage URL (existing)
 * - `file`     — only set when the user just picked the file; undefined for existing images
 */
type ImageEntry = { preview: string; file?: File }

type FormState = {
  name: string
  brand: string
  tagline: string
  price: string
  discountPct: string
  moq: string
  hasTiers: boolean
  tiers: TierRow[]
  category: string
  categories: string[]
  tags: ProductTag[]
  size: string
  stock: string
  description: string
  howToUse: string
  benefits: string[]
  ingredients: string[]
  concerns: string[]
  skinTypes: string[]
  images: ImageEntry[]
  hasVariants: boolean
  variants: VariantRow[]
}

const inputClass =
  "w-full border border-border bg-background px-4 py-3 text-sm font-light outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"

/** Split pasted benefit prose on sentence boundaries (full stops). */
function splitBenefitsPaste(raw: string): string[] {
  return raw
    .split(/\.(?:\s+|$)/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => (s.endsWith(".") ? s : s))
}

/* ─── Helpers ────────────────────────────────────────────────── */
function toFormState(product?: Product): FormState {
  const hasVariants = !!(product?.variants && product.variants.length > 0)
  const hasTiers = !!(product?.priceTiers && product.priceTiers.length > 0)
  const rawImages = product?.images ?? (product?.image ? [product.image] : [])
  return {
    name: product?.name ?? "",
    brand: product?.brand ?? "",
    tagline: product?.tagline ?? "",
    price: product ? String(product.price) : "",
    discountPct: product?.discountPct ? String(product.discountPct) : "",
    moq: product?.moq && product.moq > 1 ? String(product.moq) : "1",
    hasTiers,
    tiers: hasTiers
      ? product!.priceTiers!.map(t => ({ qty: String(t.qty), value: String(t.value) }))
      : [{ qty: "3", value: "" }, { qty: "6", value: "" }],
    category: product?.category ?? "",
    categories: product?.categories?.length
      ? product.categories
      : product?.category
        ? [product.category]
        : [],
    tags: productTags(product ?? {}),
    size: product?.size ?? "",
    stock: product ? String(product.stock) : "",
    description: product?.description ?? "",
    howToUse: (product as (Product & { howToUse?: string }) | undefined)?.howToUse ?? "",
    benefits: product?.benefits?.length ? product.benefits : [""],
    ingredients: product?.ingredients?.filter(Boolean) ?? [],
    concerns: product?.concerns ?? [],
    skinTypes: product?.skinTypes ?? [],
    // Existing images become entries without a file (they're already uploaded)
    images: rawImages.map(url => ({ preview: url })),
    hasVariants,
    variants: hasVariants
      ? product!.variants!.map(v => ({ label: v.label, price: String(v.price) }))
      : [{ label: "", price: "" }],
  }
}

/** Non-blocking merchandising warnings. Does not change what save accepts. */
function getPublishWarnings(form: Pick<FormState, "name" | "brand" | "tagline" | "price" | "stock" | "images">) {
  const warnings: string[] = []
  if (!form.images.some(image => image.preview.trim())) {
    warnings.push("Missing image")
  }
  if (!form.brand.trim()) {
    warnings.push("Missing brand")
  }
  const name = form.name.trim().replace(/\s+/g, " ")
  const tagline = form.tagline.trim().replace(/\s+/g, " ")
  if (!tagline) {
    warnings.push("Tagline is empty")
  } else if (name && tagline.toLowerCase() === name.toLowerCase()) {
    warnings.push("Tagline matches the product name")
  }
  const price = Number(form.price)
  if (!form.price.trim() || !Number.isFinite(price) || price <= 0) {
    warnings.push("Price is missing or not above ₦0")
  }
  // save stores `parseInt(stock) || 0`, so a blank field publishes as zero.
  if ((parseInt(form.stock, 10) || 0) === 0) {
    warnings.push("Stock is 0")
  }
  return warnings
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

/* ─── Main component ─────────────────────────────────────────── */
export function AdminProductForm({ product }: { product?: Product }) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(toFormState(product))
  const [brands, setBrands] = useState<Brand[]>([])
  const [categoryTree, setCategoryTree] = useState<CategorySection[]>([])
  const [ingredientOptions, setIngredientOptions] = useState<string[]>([])
  const [concernOptions, setConcernOptions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const isEdit = !!product

  useEffect(() => {
    getActiveBrands().then(list => {
      setBrands(list)
      // New products start with no brand selected (the field is required), so
      // nothing is saved under the first brand in the list by accident.
      // Existing products: match the saved brand to the Brands list even when
      // the capitalisation or punctuation differs (e.g. "Bioderma" vs "BIODERMA").
      setForm(f => {
        if (!f.brand || list.some(b => b.name === f.brand)) return f
        const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "")
        const match = list.find(b => norm(b.name) === norm(f.brand))
        return match ? { ...f, brand: match.name } : f
      })
    })
    // No default category: the form requires at least one before saving.
    getCategoryTree().then(setCategoryTree)
    getCatalogNames("ingredients").then(setIngredientOptions)
    getCatalogNames("concerns").then(setConcernOptions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Generic field setter ── */
  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  /* ── Image handling ── */
  function addImageFiles(files: FileList | null) {
    if (!files) return
    const entries: ImageEntry[] = Array.from(files)
      .filter(f => f.type.startsWith("image/"))
      .map(f => ({ preview: URL.createObjectURL(f), file: f }))
    setForm(f => ({ ...f, images: [...f.images, ...entries] }))
  }

  function removeImage(i: number) {
    setForm(f => {
      const entry = f.images[i]
      // Revoke blob URL to free memory
      if (entry?.file) URL.revokeObjectURL(entry.preview)
      return { ...f, images: f.images.filter((_, idx) => idx !== i) }
    })
  }

  function moveImage(from: number, to: number) {
    setForm(f => {
      const imgs = [...f.images]
      const [item] = imgs.splice(from, 1)
      imgs.splice(to, 0, item)
      return { ...f, images: imgs }
    })
  }

  /* ── Benefits array helpers ── */
  function setArrayItem(key: "benefits", i: number, val: string) {
    setForm(f => {
      const arr = [...f[key]]
      arr[i] = val
      return { ...f, [key]: arr }
    })
  }

  function addArrayItem(key: "benefits") {
    setForm(f => ({ ...f, [key]: [...f[key], ""] }))
  }

  function removeArrayItem(key: "benefits", i: number) {
    setForm(f => ({ ...f, [key]: f[key].filter((_, idx) => idx !== i) }))
  }

  function handleBenefitsPaste(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text")
    if (!text.includes(".")) return
    e.preventDefault()
    const parts = splitBenefitsPaste(text)
    if (!parts.length) return
    setForm(f => {
      const next = [...f.benefits]
      // Replace current row + following empties with split sentences
      next.splice(i, 1, ...parts)
      // Drop trailing empty placeholders
      const cleaned = next.filter((b, idx) => b.trim() || idx === next.length - 1)
      return { ...f, benefits: cleaned.length ? cleaned : parts }
    })
  }

  function toggleProductTag(tag: ProductTag) {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }))
  }

  /* ── Variant helpers ── */
  function addVariant() {
    setForm(f => ({ ...f, variants: [...f.variants, { label: "", price: "" }] }))
  }

  function removeVariant(i: number) {
    setForm(f => ({ ...f, variants: f.variants.filter((_, idx) => idx !== i) }))
  }

  function setVariantField(i: number, key: keyof VariantRow, val: string) {
    setForm(f => {
      const rows = [...f.variants]
      rows[i] = { ...rows[i], [key]: val }
      return { ...f, variants: rows }
    })
  }

  /* ── Tier helpers ── */
  function addTier() {
    setForm(f => ({ ...f, tiers: [...f.tiers, { qty: "", value: "" }] }))
  }

  function removeTier(i: number) {
    setForm(f => ({
      ...f,
      tiers: f.tiers.length <= 1 ? f.tiers : f.tiers.filter((_, idx) => idx !== i),
    }))
  }

  function setTierField(i: number, key: keyof TierRow, val: string) {
    setForm(f => {
      const rows = [...f.tiers]
      rows[i] = { ...rows[i], [key]: val }
      return { ...f, tiers: rows }
    })
  }

  /* ── Submit ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setUploadError("")

    if (!form.categories.length) {
      setUploadError("Select at least one category.")
      setSaving(false)
      return
    }

    try {
      // ── Step 1: Upload any new files to Supabase Storage ──────────
      const productSlug =
        product?.id ??
        form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

      const { uploadProductImage } = await import("@/lib/supabase/storage")

      const resolvedImages: string[] = await Promise.all(
        form.images.map(entry => {
          if (entry.file) {
            // New file — upload it
            return uploadProductImage(entry.file, productSlug)
          }
          // Already a real URL — keep as-is
          return Promise.resolve(entry.preview)
        }),
      )

      // ── Step 2: Save product row with resolved URLs ────────────────
      const { saveProduct } = await import("@/lib/supabase/products")

      const priceTiers =
        form.hasTiers
          ? form.tiers
            .map(t => ({
              qty: parseInt(t.qty, 10) || 0,
              value: parseFloat(t.value) || 0,
            }))
            .filter(t => t.qty >= 2 && t.value > 0)
            .sort((a, b) => a.qty - b.qty)
          : []

      const payload = {
        id: productSlug,
        name: form.name,
        brand: form.brand,
        tagline: form.tagline,
        description: form.description,
        price: parseFloat(form.price) || 0,
        discountPct: Math.min(100, Math.max(0, parseInt(form.discountPct, 10) || 0)),
        moq: Math.max(1, parseInt(form.moq, 10) || 1),
        priceTiers: priceTiers.length ? priceTiers : undefined,
        image: resolvedImages[0] ?? "/product-cleanser.png",
        images: resolvedImages.length > 0 ? resolvedImages : undefined,
        category: form.categories[0] ?? "",
        categories: form.categories,
        tag: form.tags[0],
        tags: form.tags,
        benefits: form.benefits.filter(Boolean),
        ingredients: form.ingredients.filter(Boolean),
        concerns: form.concerns,
        skinTypes: form.skinTypes,
        stock: parseInt(form.stock) || 0,
        size: form.size || undefined,
        howToUse: form.howToUse || undefined,
        variants:
          form.hasVariants && form.variants.some(v => v.label && v.price)
            ? form.variants
              .filter(v => v.label && v.price)
              .map(v => ({ label: v.label, price: parseFloat(v.price) }))
            : undefined,
      } as Parameters<typeof saveProduct>[0]

      await saveProduct(payload, product?.id)
      const { revalidateProducts } = await import("@/app/actions/revalidate")
      // Save already succeeded; a refused refresh only delays the storefront (≤1h ISR window).
      const refreshed = await revalidateProducts(payload.id || product?.id)
      if (!refreshed.ok) console.warn("[product] storefront refresh skipped:", refreshed.error)
    } catch (err) {
      console.error("Failed to save product:", err)
      setUploadError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
      setSaving(false)
      return
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      router.push("/admin/products")
    }, 1200)
  }

  async function confirmArchive() {
    if (!product) return
    setArchiving(true)
    setUploadError("")
    try {
      await setProductArchived(product.id, !product.archived)
      const { revalidateProducts } = await import("@/app/actions/revalidate")
      const refreshed = await revalidateProducts(product.id)
      if (!refreshed.ok) console.warn("[product] storefront refresh skipped:", refreshed.error)
      router.push("/admin/products")
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not update archive status.")
      setArchiving(false)
      setArchiveOpen(false)
    }
  }

  const publishWarnings = getPublishWarnings(form)

  function renderStorefrontPreview() {
    return (
      <AdminProductPreview
        name={form.name}
        brand={form.brand}
        tagline={form.tagline}
        price={form.price}
        discountPct={form.discountPct}
        imageSrc={form.images[0]?.preview}
      />
    )
  }

  /* ─────────────────────────────────────────────────────────── */
  return (
    <div className="admin-page">
      {/* Sticky header */}
      <div className="admin-page-header">
        <div className="flex w-full min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => router.push("/admin/products")}
            className="flex shrink-0 items-center gap-1.5 text-xs font-light text-muted-foreground hover:text-foreground transition-colors uppercase tracking-[0.15em]"
          >
            <ArrowLeft className="size-3.5" /> Products
          </button>
          <span className="hidden text-border sm:inline">/</span>
          <h1 className="font-serif text-lg font-medium sm:text-xl truncate">
            {isEdit ? `Edit — ${product.name}` : "Add Product"}
          </h1>
          {product?.archived && (
            <span className="border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Archived
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isEdit && (
            <button
              type="button"
              onClick={() => setArchiveOpen(true)}
              className="flex items-center gap-2 border border-border px-4 py-2 text-xs font-light uppercase tracking-[0.15em] hover:border-foreground transition-colors"
            >
              {product?.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
              {product?.archived ? "Restore" : "Archive"}
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push("/admin/products")}
            className="border border-border px-4 py-2 text-xs font-light uppercase tracking-[0.15em] hover:border-foreground transition-colors"
          >
            Discard
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={saving}
            className={cn(
              "flex items-center gap-2 px-5 py-2 text-xs font-medium uppercase tracking-[0.15em] transition-all",
              saved
                ? "bg-gold text-gold-foreground"
                : saving
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-foreground text-background hover:bg-gold hover:text-gold-foreground",
            )}
          >
            {saved ? (
              <><Check className="size-3.5" /> Saved!</>
            ) : saving ? (
              <>
                <span className="size-3.5 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                {form.images.some(img => img.file) ? "Uploading…" : "Saving…"}
              </>
            ) : (
              <><Save className="size-3.5" /> {isEdit ? "Save Changes" : "Add Product"}</>
            )}
          </button>
        </div>
        </div>
        {publishWarnings.length > 0 && (
          <div aria-live="polite">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Publish checklist
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs font-light text-amber-700">
              {publishWarnings.map(warning => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        </div>
      </div>

      <form id="product-form" onSubmit={handleSubmit}>
        <div className="admin-page-body">
          <div className="mb-6 lg:hidden">
            {renderStorefrontPreview()}
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">

            {/* ── LEFT COLUMN ──────────────────────────────────── */}
            <div className="space-y-6">

              {/* Basic info */}
              <section className="border border-border p-6">
                <h2 className="mb-5 text-xs font-medium uppercase tracking-[0.18em]">Basic Information</h2>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Product Name" required>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setField("name", e.target.value)}
                        placeholder="e.g. Hydrating Facial Cleanser"
                        required
                        className="input-field"
                      />
                    </Field>
                    <Field label="Brand" required>
                      <select
                        value={form.brand}
                        onChange={e => setField("brand", e.target.value)}
                        className={inputClass}
                        required
                      >
                        <option value="">Select brand…</option>
                        {form.brand && !brands.some(b => b.name === form.brand) && (
                          <option value={form.brand}>{form.brand}</option>
                        )}
                        {brands.map(b => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                      {brands.length === 0 && (
                        <p className="mt-1 text-[10px] font-light text-muted-foreground">
                          No brands yet — add some under Admin → Brands.
                        </p>
                      )}
                    </Field>
                  </div>
                  <Field label="Tagline" required hint="Appears below the product name as a one-liner summary">
                    <input
                      type="text"
                      value={form.tagline}
                      onChange={e => setField("tagline", e.target.value)}
                      placeholder="e.g. Gentle daily cleanser for normal to dry skin"
                      required
                      className="input-field"
                    />
                  </Field>
                  <Field label="Description" required hint="3–5 sentences explaining formulation, texture, and key effects">
                    <textarea
                      value={form.description}
                      onChange={e => setField("description", e.target.value)}
                      rows={4}
                      placeholder="Describe the product, its texture, key actives, and what skin types it suits…"
                      required
                      className="input-field resize-none"
                    />
                  </Field>
                </div>
              </section>

              {/* How to Use */}
              <section className="border border-border p-6">
                <h2 className="mb-5 text-xs font-medium uppercase tracking-[0.18em]">How to Use</h2>
                <Field label="Application instructions" hint="Shown in the 'How to Use' tab on the storefront product page">
                  <textarea
                    value={form.howToUse}
                    onChange={e => setField("howToUse", e.target.value)}
                    rows={4}
                    placeholder="e.g. Apply 3–4 drops to clean, dry skin morning and evening. Follow with moisturiser and SPF in the AM. Start 2–3x per week and increase as tolerated."
                    className="input-field resize-none"
                  />
                </Field>
              </section>

              {/* Benefits */}
              <section className="border border-border p-6">
                <h2 className="mb-5 text-xs font-medium uppercase tracking-[0.18em]">Benefits</h2>
                <p className="mb-3 text-[11px] font-light text-muted-foreground">
                  Listed as checkmarks on the storefront product page. Paste a paragraph of sentences — each full stop starts a new line.
                </p>
                <div className="space-y-2">
                  {form.benefits.map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-4 shrink-0 text-[10px] font-light text-muted-foreground">{i + 1}.</span>
                      <input
                        type="text"
                        value={b}
                        onChange={e => setArrayItem("benefits", i, e.target.value)}
                        onPaste={e => handleBenefitsPaste(i, e)}
                        placeholder={`Benefit ${i + 1}`}
                        className="input-field flex-1"
                      />
                      {form.benefits.length > 1 && (
                        <button type="button" onClick={() => removeArrayItem("benefits", i)}
                          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addArrayItem("benefits")}
                    className="mt-1 flex items-center gap-1.5 text-[11px] font-light uppercase tracking-[0.15em] text-gold hover:underline underline-offset-2"
                  >
                    <Plus className="size-3.5" /> Add Benefit
                  </button>
                </div>
              </section>

              {/* Key Ingredients */}
              <section className="border border-border p-6">
                <TagPicker
                  label="Key Ingredients"
                  hint="Search catalog ingredients or add a custom one — new values are saved to Admin → Catalog Tags."
                  options={ingredientOptions.length ? ingredientOptions : []}
                  value={form.ingredients}
                  onChange={ingredients => setForm(f => ({ ...f, ingredients }))}
                  placeholder="Search ingredients (e.g. Niacinamide)…"
                />
              </section>

              {/* Skin Types */}
              <section className="border border-border p-6">
                <TagPicker
                  label="Skin Types"
                  hint="Who is this product best for? Used on the storefront skin-type browse."
                  options={ALL_SKIN_TYPES}
                  value={form.skinTypes}
                  onChange={skinTypes => setForm(f => ({ ...f, skinTypes }))}
                  placeholder="Search skin types…"
                  allowCustom={false}
                />
              </section>

              {/* Skin Concerns */}
              <section className="border border-border p-6">
                <TagPicker
                  label="Skin Concerns"
                  hint="Determines which concern filters and shop-by-concern pages include this product. Custom values are added to the shared catalog."
                  options={concernOptions}
                  value={form.concerns}
                  onChange={concerns => setForm(f => ({ ...f, concerns }))}
                  placeholder="Search concerns (e.g. Acne)…"
                />
              </section>
            </div>

            {/* ── RIGHT COLUMN ─────────────────────────────────── */}
            <div className="space-y-6">

              <div className="hidden lg:block">
                {renderStorefrontPreview()}
              </div>

              {/* Image gallery */}
              <section className="border border-border p-6">
                <h2 className="mb-1 text-xs font-medium uppercase tracking-[0.18em]">Product Images</h2>
                <p className="mb-4 text-[10px] font-light text-muted-foreground">
                  First image is the primary. Drag to reorder.
                </p>

                {/* Thumbnails grid */}
                {form.images.length > 0 && (
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    {form.images.map((entry, i) => (
                      <div key={i} className="group relative aspect-square overflow-hidden border border-border bg-secondary">
                        {i === 0 && (
                          <span className="absolute left-1 top-1 z-10 bg-foreground px-1.5 py-0.5 text-[9px] font-medium text-background uppercase tracking-[0.1em]">
                            Primary
                          </span>
                        )}
                        {entry.file && (
                          <span className="absolute right-1 top-1 z-10 bg-gold/90 px-1.5 py-0.5 text-[9px] font-medium text-white uppercase tracking-[0.1em]">
                            New
                          </span>
                        )}
                        {/* Use plain <img> so blob: URLs work without next/image config */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={entry.preview}
                          alt={`Product image ${i + 1}`}
                          className="absolute inset-0 h-full w-full object-contain mix-blend-multiply"
                        />
                        {/* Overlay actions on hover */}
                        <div className="absolute inset-0 flex items-center justify-center gap-1 bg-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
                          {i > 0 && (
                            <button
                              type="button"
                              onClick={() => moveImage(i, i - 1)}
                              title="Move left"
                              className="flex size-6 items-center justify-center bg-background text-foreground hover:bg-gold hover:text-gold-foreground transition-colors"
                            >
                              <GripVertical className="size-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(i)}
                            title="Remove"
                            className="flex size-6 items-center justify-center bg-background text-foreground hover:bg-destructive hover:text-background transition-colors"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Drop zone */}
                <div
                  onDrop={e => { e.preventDefault(); setDragOver(false); addImageFiles(e.dataTransfer.files) }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    "mb-3 flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed py-6 transition-colors",
                    dragOver ? "border-gold bg-lavender" : "border-border hover:border-foreground/40",
                  )}
                >
                  <Upload className="size-6 text-muted-foreground" />
                  <p className="text-xs font-light text-muted-foreground text-center">
                    Drop images here or <span className="text-foreground font-medium">click to browse</span>
                  </p>
                  <p className="text-[10px] font-light text-muted-foreground">PNG, JPG, WebP — multiple allowed</p>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={e => addImageFiles(e.target.files)}
                />
                <p className="text-[10px] font-light text-muted-foreground/70 text-center">
                  Images are uploaded to Supabase Storage on save. Max 5 MB per file.
                </p>
                {uploadError && (
                  <p className="mt-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2">
                    {uploadError}
                  </p>
                )}
              </section>

              {/* Pricing & meta */}
              <section className="border border-border p-6">
                <h2 className="mb-5 text-xs font-medium uppercase tracking-[0.18em]">Pricing & Details</h2>
                <div className="space-y-4">
                  <Field
                    label="Base price (₦)"
                    required
                    hint="List price. Charged unit = (SKU after general %) − volume ₦ off"
                  >
                    <div className="relative">
                      {!form.price && (
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          ₦
                        </span>
                      )}
                      <input
                        type="number"
                        value={form.price}
                        onChange={e => setField("price", e.target.value)}
                        placeholder={!form.price ? "0" : undefined}
                        min="0"
                        step="100"
                        required
                        className={cn("input-field", !form.price && "pl-8")}
                      />
                    </div>
                  </Field>

                  <Field
                    label="Discount (%)"
                    hint="General % off list/SKU price on shop, product page, cart, and checkout. Volume tiers apply after this."
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
                        const v = Math.min(100, Math.max(0, parseInt(n, 10) || 0))
                        setField("discountPct", String(v))
                      }}
                      placeholder="0"
                      min="0"
                      max="100"
                      className="input-field"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Stock quantity" required>
                      <input
                        type="number"
                        value={form.stock}
                        onChange={e => setField("stock", e.target.value)}
                        placeholder="0"
                        min="0"
                        required
                        className="input-field"
                      />
                    </Field>
                    <Field
                      label="MOQ"
                      hint="Minimum order quantity in cart (default 1)"
                      required
                    >
                      <input
                        type="number"
                        value={form.moq}
                        onChange={e => {
                          const n = e.target.value
                          if (n === "") {
                            setField("moq", "")
                            return
                          }
                          setField("moq", String(Math.max(1, parseInt(n, 10) || 1)))
                        }}
                        placeholder="1"
                        min="1"
                        required
                        className="input-field"
                      />
                    </Field>
                  </div>

                  <Field label="Size / Volume" hint="Used when there are no variants">
                    <input
                      type="text"
                      value={form.size}
                      onChange={e => setField("size", e.target.value)}
                      placeholder="e.g. 30ml"
                      disabled={form.hasVariants}
                      className={cn("input-field", form.hasVariants && "opacity-40 cursor-not-allowed")}
                    />
                  </Field>

                  {/* Tiered pricing (optional) */}
                  <div className="border border-border p-4 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div
                        role="checkbox"
                        aria-checked={form.hasTiers}
                        tabIndex={0}
                        onClick={() => setField("hasTiers", !form.hasTiers)}
                        onKeyDown={e => e.key === " " && setField("hasTiers", !form.hasTiers)}
                        className={cn(
                          "relative h-5 w-9 rounded-full transition-colors shrink-0",
                          form.hasTiers ? "bg-foreground" : "bg-muted-foreground/30",
                        )}
                      >
                        <span className={cn(
                          "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
                          form.hasTiers ? "translate-x-4" : "translate-x-0.5",
                        )} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Quantity promotions (volume discount)</p>
                        <p className="text-[11px] font-light text-muted-foreground">
                          Optional absolute ₦ off base — e.g. buy 10+ save ₦500/unit, 50+ save ₦900/unit
                        </p>
                      </div>
                    </label>

                    {form.hasTiers && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-2 mb-1 sm:grid-cols-[1fr_1fr_auto]">
                          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                            Min qty
                          </p>
                          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                            Discount off base (₦)
                          </p>
                          <span />
                        </div>
                        {form.tiers.map((t, i) => (
                          <div key={i} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
                            <input
                              type="number"
                              value={t.qty}
                              onChange={e => setTierField(i, "qty", e.target.value)}
                              placeholder="e.g. 10"
                              min="2"
                              className="input-field"
                            />
                            <input
                              type="number"
                              value={t.value}
                              onChange={e => setTierField(i, "value", e.target.value)}
                              placeholder="e.g. 500"
                              min="0"
                              step="100"
                              className="input-field"
                            />
                            <button
                              type="button"
                              onClick={() => removeTier(i)}
                              disabled={form.tiers.length === 1}
                              className="flex size-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addTier}
                          className="mt-1 flex items-center gap-1.5 text-xs font-light text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Plus className="size-3.5" /> Add tier
                        </button>
                        <p className="text-[10px] font-light text-muted-foreground/60">
                          Applied after general %. Unit = (SKU after %) − this ₦ off. Below the first tier (from MOQ), only general % applies.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Variants toggle + builder */}
                  <div className="border border-border p-4 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div
                        role="checkbox"
                        aria-checked={form.hasVariants}
                        tabIndex={0}
                        onClick={() => setField("hasVariants", !form.hasVariants)}
                        onKeyDown={e => e.key === " " && setField("hasVariants", !form.hasVariants)}
                        className={cn(
                          "relative h-5 w-9 rounded-full transition-colors",
                          form.hasVariants ? "bg-foreground" : "bg-muted-foreground/30",
                        )}
                      >
                        <span className={cn(
                          "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
                          form.hasVariants ? "translate-x-4" : "translate-x-0.5",
                        )} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">This product has size variants</p>
                        <p className="text-[11px] font-light text-muted-foreground">
                          e.g. 30ml / 50ml / 100ml each with their own price
                        </p>
                      </div>
                    </label>

                    {form.hasVariants && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-2 mb-1 sm:grid-cols-[1fr_1fr_auto]">
                          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Label</p>
                          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">SKU price (₦)</p>
                          <span />
                        </div>
                        {form.variants.map((v, i) => (
                          <div key={i} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
                            <input
                              type="text"
                              value={v.label}
                              onChange={e => setVariantField(i, "label", e.target.value)}
                              placeholder="e.g. 30ml"
                              className="input-field"
                            />
                            <input
                              type="number"
                              value={v.price}
                              onChange={e => setVariantField(i, "price", e.target.value)}
                              placeholder="e.g. 5500"
                              min="0"
                              className="input-field"
                            />
                            <button
                              type="button"
                              onClick={() => removeVariant(i)}
                              disabled={form.variants.length === 1}
                              className="flex size-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addVariant}
                          className="mt-1 flex items-center gap-1.5 text-xs font-light text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Plus className="size-3.5" /> Add variant
                        </button>
                        <p className="text-[10px] font-light text-muted-foreground/60">
                          Absolute SKU price. Charged unit = SKU − volume discount (delta vs base is applied automatically).
                        </p>
                      </div>
                    )}
                  </div>

                  <Field label="Categories" required hint="A product can belong to multiple subcategories. First selected is the primary.">
                    <CategoryMultiSelect
                      tree={categoryTree}
                      value={form.categories}
                      onChange={categories =>
                        setForm(f => ({
                          ...f,
                          categories,
                          category: categories[0] ?? "",
                        }))
                      }
                    />
                    {categoryTree.length === 0 && (
                      <p className="text-[10px] font-light text-muted-foreground">
                        No categories yet — add some under Admin → Categories.
                      </p>
                    )}
                  </Field>

                  <Field label="Tags (optional)" hint="A product can have multiple badges (e.g. Bestseller + Low Stock).">
                    <div className="flex flex-wrap gap-2">
                      {PRODUCT_TAGS.map(t => {
                        const on = form.tags.includes(t)
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleProductTag(t)}
                            className={cn(
                              "border px-3 py-1.5 text-xs font-light transition-all",
                              on
                                ? "border-gold bg-lavender text-gold"
                                : "border-border text-muted-foreground hover:border-gold/60",
                            )}
                          >
                            {on ? "✓ " : ""}{t}
                          </button>
                        )
                      })}
                    </div>
                  </Field>
                </div>
              </section>

            </div>
          </div>
        </div>
      </form>

      {archiveOpen && product && (
        <>
          <div className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]" onClick={() => !archiving && setArchiveOpen(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 border border-border bg-background p-6 shadow-2xl">
            <h3 className="mb-2 font-serif text-xl font-medium">
              {product.archived ? "Restore Product" : "Archive Product"}
            </h3>
            <p className="mb-6 text-sm font-light text-muted-foreground">
              {product.archived
                ? `${product.name} will show on the store again.`
                : `${product.name} will be hidden from the store. You can restore it later.`}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setArchiveOpen(false)}
                disabled={archiving}
                className="flex-1 border border-border py-3 text-xs font-medium uppercase tracking-[0.15em] hover:border-foreground disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmArchive()}
                disabled={archiving}
                className="flex flex-1 items-center justify-center gap-2 bg-foreground py-3 text-xs font-medium uppercase tracking-[0.15em] text-background hover:bg-gold hover:text-gold-foreground disabled:opacity-60"
              >
                {archiving ? "Working…" : product.archived ? "Restore" : "Archive"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Ensure inputs always show a visible border in admin */}
      <style jsx global>{`
        form#product-form .input-field {
          width: 100%;
          border: 1px solid var(--border);
          background: var(--background);
          padding: 0.625rem 1rem;
          font-size: 0.875rem;
          font-weight: 300;
          outline: none;
          transition: border-color 0.15s;
        }
        form#product-form .input-field:focus {
          border-color: var(--foreground);
        }
        form#product-form .input-field.pl-8 {
          padding-left: 2rem;
        }
      `}</style>
    </div>
  )
}
