"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Check } from "lucide-react"
import { getWhatsAppDisplay, getWhatsAppNumber } from "@/lib/whatsapp"

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { label: "All Products", href: "/shop" },
      { label: "Face", href: "/shop?category=face-cleansers-wash" },
      { label: "Bath & Body", href: "/shop?category=body-wash" },
      { label: "Perfume", href: "/shop?category=body-mist-and-spray" },
      { label: "Combo Deals", href: "/deals" },
      { label: "Wholesale", href: "/wholesale" },
    ],
  },
  {
    title: "Discover",
    links: [
      { label: "Brands", href: "/brands" },
      { label: "Shop by Concern", href: "/shop?filter=concerns" },
      { label: "Shop by Ingredient", href: "/shop?filter=ingredients" },
      { label: "Skin Blog", href: "/journal" },
      { label: "Offers & Sales", href: "/shop?sale=true" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Contact Us", href: "/contact" },
      { label: "FAQs", href: "/contact" },
      { label: "Shipping & Delivery", href: "/contact" },
      { label: "Returns Policy", href: "/contact" },
      { label: "Track My Order", href: "/account/orders" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About HAYDA", href: "/about" },
      { label: "Wholesale", href: "/wholesale" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Use", href: "/terms" },
    ],
  },
]

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}
function IconFacebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  )
}
function IconTikTok({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.5a8.17 8.17 0 004.78 1.52V6.56a4.85 4.85 0 01-1.01.13z" />
    </svg>
  )
}

const SOCIALS = [
  { label: "Instagram", icon: IconInstagram, href: "#" },
  { label: "Facebook", icon: IconFacebook, href: "#" },
  { label: "TikTok", icon: IconTikTok, href: "#" },
]

/* Inline payment brand SVGs */
function PaystackIcon() {
  return (
    <svg viewBox="0 0 80 24" className="h-5 w-auto" aria-label="Paystack">
      <text x="0" y="18" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="700" fill="currentColor">Paystack</text>
    </svg>
  )
}
function VisaIcon() {
  return (
    <svg viewBox="0 0 48 16" className="h-4 w-auto" aria-label="Visa">
      <rect width="48" height="16" rx="3" fill="#1A1F71" />
      <text x="8" y="12" fontFamily="Georgia, serif" fontSize="12" fontWeight="700" fontStyle="italic" fill="#fff">VISA</text>
    </svg>
  )
}
function MastercardIcon() {
  return (
    <svg viewBox="0 0 38 24" className="h-5 w-auto" aria-label="Mastercard">
      <circle cx="14" cy="12" r="10" fill="#EB001B" />
      <circle cx="24" cy="12" r="10" fill="#F79E1B" />
      <path d="M19 5.3a10 10 0 0 1 0 13.4A10 10 0 0 1 19 5.3z" fill="#FF5F00" />
    </svg>
  )
}
function VerveIcon() {
  return (
    <svg viewBox="0 0 60 20" className="h-4 w-auto" aria-label="Verve">
      <rect width="60" height="20" rx="3" fill="#004B87" />
      <text x="6" y="14" fontFamily="system-ui, sans-serif" fontSize="11" fontWeight="700" fill="#fff">VERVE</text>
    </svg>
  )
}

export function SiteFooter() {
  const [email, setEmail] = useState("")
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "footer" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not subscribe.")
        return
      }
      setSubscribed(true)
      setEmail("")
      setTimeout(() => setSubscribed(false), 4000)
    } catch {
      setError("Could not subscribe. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <footer className="border-t border-border bg-background">
      {/* Newsletter band */}
      <div className="border-b border-border bg-muted">
        <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-serif text-2xl font-medium">Join the HAYDA community</h3>
              <p className="mt-1 text-sm font-light text-muted-foreground">
                Get skincare tips, early access to deals, and new arrivals straight to your inbox.
              </p>
            </div>
            <form onSubmit={handleSubscribe} className="flex w-full max-w-sm flex-col gap-2 shrink-0">
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Your email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="flex-1 border border-border bg-background px-4 py-3 text-sm font-light outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground/50"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="shrink-0 bg-foreground px-5 py-3 text-xs font-medium uppercase tracking-[0.15em] text-background transition-colors hover:bg-gold hover:text-gold-foreground disabled:opacity-60"
                >
                  {subscribed ? <Check className="size-4" /> : loading ? "…" : "Subscribe"}
                </button>
              </div>
              {error && <p className="text-xs font-light text-destructive">{error}</p>}
            </form>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          {/* Brand column */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="HAYDA SKINCo. logo"
                width={160}
                height={200}
                sizes="80px"
                quality={100}
                className="size-20 object-contain"
              />
            </Link>
            <p className="mt-3 max-w-xs text-sm font-light leading-relaxed text-muted-foreground">
              Nigeria's hub for premium skincare. We stock trusted brands and deliver nationwide.
            </p>
            <p className="mt-4 text-sm font-light text-muted-foreground">
              📍 Lagos, Nigeria<br />
              📞 <a href={`tel:+${getWhatsAppNumber()}`} className="hover:text-gold transition-colors">{getWhatsAppDisplay()}</a><br />
              ✉️ <a href="mailto:hello@haydaskinco.com" className="hover:text-gold transition-colors">hello@haydaskinco.com</a>
            </p>
            {/* Social */}
            <div className="mt-5 flex gap-3">
              {SOCIALS.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="flex size-8 items-center justify-center border border-border text-muted-foreground transition-all hover:border-gold hover:text-gold"
                >
                  <s.icon className="size-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {COLUMNS.map(col => (
            <div key={col.title}>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map(link => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm font-light text-muted-foreground transition-colors hover:text-gold">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-5 border-t border-border pt-8 md:flex-row">
          <p className="text-xs font-light text-muted-foreground">
            © {new Date().getFullYear()} HAYDA SKINCo. All rights reserved.
          </p>

          {/* Payment icons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[PaystackIcon, VisaIcon, MastercardIcon, VerveIcon].map((Icon, i) => (
              <span key={i} className="flex items-center justify-center border border-border px-2.5 py-1.5 text-foreground/60">
                <Icon />
              </span>
            ))}
          </div>

          <div className="flex gap-5">
            {[
              { label: "Privacy", href: "/privacy" },
              { label: "Terms", href: "/terms" },
              { label: "Accessibility", href: "/accessibility" },
            ].map(l => (
              <Link key={l.href} href={l.href} className="text-xs font-light text-muted-foreground transition-colors hover:text-gold">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
