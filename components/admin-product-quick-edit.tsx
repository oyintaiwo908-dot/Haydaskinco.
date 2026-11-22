"use client"

import { useState, type FormEvent } from "react"
import { Sheet } from "@/components/ui/sheet"
import { formatPrice, getEffectivePrice, type Product } from "@/lib/products"

/**
 * Quick edit of discount % and stock from the admin products list. Same write path and
 * validation as the full product form (lib/supabase/products: updateProductQuickFields), then
 * the storefront refresh (revalidateProducts). Discount and stock are product-level here:
 * sizes (variants) only carry their own price, so the modal shows each size's resulting price.
 */
export function AdminProductQuickEdit({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null
  onClose: () => void
  onSaved: (id: string, values: { discountPct: number; stock: number }) => void
}) {
  return (
    <Sheet
      open={Boolean(product)}
      onOpenChange={open => {
        if (!open) onClose()
      }}
      side="center"
      title="Quick edit"
      description={product ? product.name : undefined}
      className="admin-quick-edit"
    >
      {product && <QuickEditForm key={product.id} product={product} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  )
}

function QuickEditForm({
  product,
  onClose,
  onSaved,
}: {
  product: Product
  onClose: () => void
  onSaved: (id: string, values: { discountPct: number; stock: number }) => void
}) {
  const [discount, setDiscount] = useState(product.discountPct ? String(product.discountPct) : "")
  const [stock, setStock] = useState(String(product.stock))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pct = Math.min(100, Math.max(0, parseInt(discount, 10) || 0))
  const sizes = product.variants?.length ? product.variants : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const stockNumber = Number(stock)
    if (stock.trim() === "" || !Number.isInteger(stockNumber) || stockNumber < 0) {
      setError("Stock must be a whole number, 0 or more.")
      return
    }
    setSaving(true)
    try {
      const { updateProductQuickFields } = await import("@/lib/supabase/products")
      const saved = await updateProductQuickFields(product.id, { discountPct: pct, stock: stockNumber })
      const { revalidateProducts } = await import("@/app/actions/revalidate")
      const refreshed = await revalidateProducts(product.id)
      if (!refreshed.ok) console.warn("[product] storefront refresh skipped:", refreshed.error)
      onSaved(product.id, saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this product.")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {/* noValidate: one consistent, announced message instead of the browser's own tooltip. */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Discount (%)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={discount}
            onChange={e => {
              const n = e.target.value
              if (n === "") return setDiscount("")
              setDiscount(String(Math.min(100, Math.max(0, parseInt(n, 10) || 0))))
            }}
            placeholder="0"
            className="w-full border border-border bg-background px-3 py-2.5 text-sm font-light outline-none transition-colors focus:border-foreground"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Stock quantity</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            required
            value={stock}
            onChange={e => setStock(e.target.value)}
            className="w-full border border-border bg-background px-3 py-2.5 text-sm font-light outline-none transition-colors focus:border-foreground"
          />
        </label>
      </div>

      <div className="border border-border p-3 text-xs font-light text-muted-foreground">
        {sizes ? (
          <>
            <p className="mb-1.5">Discount and stock apply to every size. Resulting prices:</p>
            <ul className="space-y-0.5">
              {sizes.map(v => (
                <li key={v.label} className="flex justify-between gap-3">
                  <span>{v.label}</span>
                  <span className="text-foreground">
                    {pct > 0 && <s className="mr-2 text-muted-foreground">{formatPrice(v.price)}</s>}
                    {formatPrice(getEffectivePrice({ price: v.price, discountPct: pct }))}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="flex justify-between gap-3">
            <span>Price customers pay</span>
            <span className="text-foreground">
              {pct > 0 && <s className="mr-2 text-muted-foreground">{formatPrice(product.price)}</s>}
              {formatPrice(getEffectivePrice({ price: product.price, discountPct: pct }))}
            </span>
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-light text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="flex-1 border border-border py-3 text-xs font-medium uppercase tracking-[0.15em] transition-colors hover:border-foreground disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 bg-foreground py-3 text-xs font-medium uppercase tracking-[0.15em] text-background transition-colors hover:bg-gold hover:text-gold-foreground disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  )
}
