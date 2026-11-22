import Link from "next/link"
import { BrandLogo } from "@/components/brand-logo"
import { Mail, MapPin, Phone } from "lucide-react"
import { FooterNewsletter } from "@/components/footer-newsletter"
import { SOCIAL_LINKS } from "@/lib/storefront-copy"
import { getWhatsAppDisplay, getWhatsAppNumber } from "@/lib/whatsapp"

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { label: "All products", href: "/shop" },
      { label: "Face", href: "/shop?category=face-cleansers-wash" },
      { label: "Bath & body", href: "/shop?category=body-wash" },
      { label: "Perfume", href: "/shop?category=body-mist-and-spray" },
      { label: "Combo deals", href: "/deals" },
      { label: "Offers", href: "/offers" },
    ],
  },
  {
    title: "Discover",
    links: [
      { label: "Brands", href: "/brands" },
      { label: "Shop by concern", href: "/shop?filter=concerns" },
      { label: "Shop by ingredient", href: "/shop?filter=ingredients" },
      { label: "Journal", href: "/journal" },
      { label: "Wholesale", href: "/wholesale" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Contact us", href: "/contact" },
      { label: "FAQs", href: "/faq" },
      { label: "Delivery", href: "/shipping" },
      { label: "Returns", href: "/returns" },
      { label: "Track my order", href: "/account/orders" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About HAYDA", href: "/about" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of use", href: "/terms" },
      { label: "Accessibility", href: "/accessibility" },
    ],
  },
]

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}
function IconFacebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  )
}
function IconTikTok({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.5a8.17 8.17 0 004.78 1.52V6.56a4.85 4.85 0 01-1.01.13z" />
    </svg>
  )
}
const SOCIAL_ICONS = { Instagram: IconInstagram, Facebook: IconFacebook, TikTok: IconTikTok } as const

const PAYMENT_MARKS = ["Paystack", "Visa", "Mastercard", "Verve"]

/** Server-rendered footer; only the newsletter form ships client JS. */
export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-navy-deep text-on-dark">
      {/* Newsletter band */}
      <div className="border-b border-on-dark/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 md:flex-row md:items-end md:justify-between lg:px-8">
          <div className="max-w-md">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-blush">The HAYDA list</p>
            <h2 className="mt-2 font-serif text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)] font-normal leading-tight">
              Skincare notes, new arrivals and early deals
            </h2>
          </div>
          <FooterNewsletter />
        </div>
      </div>

      {/* Main footer */}
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <Link href="/" aria-label="HAYDA SKINCo. home" className="inline-flex rounded-control bg-on-dark px-4 py-3">
              <BrandLogo className="h-10" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-on-dark/80">
              Nigeria&apos;s hub for premium skincare. Trusted brands, delivered nationwide.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-on-dark/80">
              <li className="flex items-center gap-2.5">
                <MapPin aria-hidden className="size-4 shrink-0 text-blush" /> Lagos, Nigeria
              </li>
              <li>
                <a href={`tel:+${getWhatsAppNumber()}`} className="inline-flex min-h-6 items-center gap-2.5 hover:text-on-dark">
                  <Phone aria-hidden className="size-4 shrink-0 text-blush" /> {getWhatsAppDisplay()}
                </a>
              </li>
              <li>
                <a href="mailto:hello@haydaskinco.com" className="inline-flex min-h-6 items-center gap-2.5 hover:text-on-dark">
                  <Mail aria-hidden className="size-4 shrink-0 text-blush" /> hello@haydaskinco.com
                </a>
              </li>
            </ul>
            <ul className="mt-5 flex gap-2" aria-label="HAYDA on social media">
              {/* Only accounts that exist are linked; add TikTok / Facebook here once they are live. */}
              {SOCIAL_LINKS.filter(s => s.label === "Instagram").map(s => {
                const Icon = SOCIAL_ICONS[s.label]
                return (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${s.label} (opens in a new tab)`}
                      className="flex size-11 items-center justify-center rounded-control border border-on-dark/25 text-on-dark/85 transition-colors hover:border-on-dark hover:text-on-dark"
                    >
                      <Icon className="size-4" />
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>

          {COLUMNS.map(col => (
            <div key={col.title}>
              <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-blush">{col.title}</h3>
              <ul className="mt-3">
                {col.links.map(link => (
                  <li key={link.label}>
                    {/* prefetch off: the footer is on every page; prefetching all its links on scroll multiplied Vercel requests (CPU budget). */}
                    <Link
                      href={link.href}
                      prefetch={false}
                      className="inline-flex min-h-10 items-center text-sm text-on-dark/80 transition-colors hover:text-on-dark"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-5 border-t border-on-dark/10 pt-8 md:flex-row md:items-center">
          <p className="text-xs text-on-dark/70">© {year} HAYDA SKINCo. All rights reserved.</p>
          <ul className="flex flex-wrap items-center gap-2" aria-label="Payment methods">
            {PAYMENT_MARKS.map(mark => (
              <li
                key={mark}
                className="rounded-control border border-on-dark/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-on-dark/80"
              >
                {mark}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
