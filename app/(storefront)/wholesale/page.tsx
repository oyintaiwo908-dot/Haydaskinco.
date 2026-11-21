"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Building2, Package, Truck } from "lucide-react"
import type { Product } from "@/lib/products"
import { getWholesaleProducts } from "@/lib/supabase/products"
import { getActiveBrands, type Brand } from "@/lib/supabase/brands"
import { WholesaleProductCard } from "@/components/wholesale-product-card"

const PERKS = [
  { icon: Package, title: "Wholesale pricing", desc: "Three tiers. A higher minimum order includes a larger discount, as listed above." },
  { icon: Truck, title: "Nationwide delivery", desc: "We deliver to salons, clinics, spas, and retailers across Nigeria." },
  { icon: Building2, title: "Authentic products", desc: "All products are 100% authentic, sourced from authorised distributors." },
]

const MINIMUMS = [
  { tier: "Starter", min: "₦100,000", discount: "10% off", note: "Perfect for small businesses" },
  { tier: "Growth", min: "₦250,000", discount: "15% off", note: "For growing salons & clinics" },
  { tier: "Scale", min: "₦500,000+", discount: "20% off", note: "For distributors & large retailers" },
]

const inputClass = "input-field"

export default function WholesalePage() {
  const [form, setForm] = useState({
    name: "", business: "", email: "", phone: "", type: "", volume: "", message: "",
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [brands, setBrands] = useState<Brand[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setProductsLoading(true)
      const [tiered, brandList] = await Promise.all([
        getWholesaleProducts(48),
        getActiveBrands(),
      ])
      if (cancelled) return
      setProducts(tiered)
      setBrands(brandList)
      setProductsLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/wholesale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not submit enquiry.")
        return
      }
      setSubmitted(true)
    } catch {
      setError("Could not submit enquiry. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      <header className="max-w-2xl border-b border-border pb-8">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.28em] text-gold">For Businesses</p>
        <h1 className="font-serif text-4xl font-medium md:text-5xl">Wholesale Store</h1>
        <p className="mt-3 max-w-xl text-pretty text-base font-light leading-relaxed text-muted-foreground">
          Supply your salon, spa, clinic, or store with authentic skincare. The tiers below set the minimum order and the discount. Delivery is nationwide.
        </p>
      </header>

      <section className="mt-10" aria-labelledby="wholesale-tiers">
        <h2 id="wholesale-tiers" className="font-serif text-2xl font-medium">Account tiers</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {MINIMUMS.map((tier, i) => (
            <article
              key={tier.tier}
              className={`flex flex-col p-6 ${i === 1 ? "border border-gold/60 bg-lavender" : "border border-border"}`}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-gold">{tier.tier}</p>
              <p className="mt-4 font-serif text-4xl font-medium leading-none">{tier.discount}</p>
              <p className="mt-4 text-sm font-light text-muted-foreground">
                Minimum order <span className="font-medium text-foreground">{tier.min}</span>
              </p>
              <p className="mt-2 text-sm font-light text-muted-foreground">{tier.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14 grid items-start gap-12 lg:grid-cols-2">
        <div className="order-1 border border-border p-6 sm:p-8 lg:order-2">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-green-50">
                <Check className="size-6 text-success" />
              </div>
              <h2 className="mb-2 font-serif text-2xl font-medium">Enquiry received</h2>
              <p className="max-w-xs text-sm font-light leading-relaxed text-muted-foreground">
                Thank you. We have the details you sent.
              </p>
            </div>
          ) : (
            <>
              <h2 className="mb-1 font-serif text-2xl font-medium">Wholesale enquiry</h2>
              <p className="mb-6 text-sm font-light text-muted-foreground">
                Tell us about your business and the brands you need.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Full Name *</span>
                    <input required type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="Jane Adeyemi" />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Business Name *</span>
                    <input required type="text" value={form.business} onChange={e => setForm(f => ({ ...f, business: e.target.value }))} className={inputClass} placeholder="Glow Studio" />
                  </label>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Email Address *</span>
                  <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputClass} placeholder="jane@glowstudio.com" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Phone Number *</span>
                  <input required type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputClass} placeholder="+234 813 730 9609" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Business Type *</span>
                  <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inputClass}>
                    <option value="">Select…</option>
                    {["Salon / Spa", "Skincare Clinic / Dermatology", "Pharmacy / Chemist", "Retail Store", "Online Reseller", "Distributor", "Other"].map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Monthly Order Volume</span>
                  <select value={form.volume} onChange={e => setForm(f => ({ ...f, volume: e.target.value }))} className={inputClass}>
                    <option value="">Select…</option>
                    {["Under ₦100,000", "₦100,000 – ₦250,000", "₦250,000 – ₦500,000", "₦500,000+"].map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">Additional Notes</span>
                  <textarea rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className={`${inputClass} resize-none`} placeholder="Tell us what products or brands you're interested in…" />
                </label>
                {error && (
                  <p className="text-sm font-light text-destructive">{error}</p>
                )}
                <button type="submit" disabled={loading} className="w-full bg-foreground py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-background transition-all hover:bg-gold hover:text-gold-foreground disabled:opacity-60">
                  {loading ? "Submitting…" : "Submit Enquiry"}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="order-2 space-y-10 lg:order-1">
          <div>
            <h2 className="mb-6 font-serif text-2xl font-medium">Why partner with HAYDA?</h2>
            <div className="space-y-5">
              {PERKS.map(perk => (
                <div key={perk.title} className="flex gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center border border-border bg-secondary">
                    <perk.icon className="size-4 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{perk.title}</p>
                    <p className="mt-0.5 text-sm font-light leading-relaxed text-muted-foreground">{perk.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {brands.length > 0 && (
            <div>
              <h2 className="mb-3 font-serif text-xl font-medium">Brands we supply</h2>
              <div className="flex flex-wrap gap-2">
                {brands.map(b => (
                  <span key={b.id} className="border border-border px-3 py-1.5 text-xs font-light text-muted-foreground">
                    {b.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-20 border-t border-border pt-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-medium">Volume pricing</h2>
            <p className="mt-1 max-w-xl text-sm font-light text-muted-foreground">
              Products with quantity breaks — buy more, pay less per unit. Tap through to order on the product page.
            </p>
          </div>
          <Link
            href="/shop"
            className="text-xs font-medium uppercase tracking-[0.15em] text-gold hover:underline"
          >
            Browse full shop →
          </Link>
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="border border-border">
                <div className="aspect-square animate-pulse bg-muted/50" />
                <div className="space-y-2 p-4">
                  <div className="h-3 w-3/4 animate-pulse bg-muted/50" />
                  <div className="h-3 w-1/2 animate-pulse bg-muted/40" />
                  <div className="mt-3 h-4 w-2/3 animate-pulse bg-muted/50" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="border border-dashed border-border px-6 py-14 text-center">
            <p className="font-serif text-xl font-medium">No volume deals yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm font-light text-muted-foreground">
              Products with tiered wholesale pricing will appear here once they&apos;re set up in the catalogue.
            </p>
            <Link
              href="/shop"
              className="mt-6 inline-block border border-foreground px-6 py-3 text-xs font-medium uppercase tracking-[0.15em] transition-colors hover:bg-foreground hover:text-background"
            >
              Shop all products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product, i) => (
              <WholesaleProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
