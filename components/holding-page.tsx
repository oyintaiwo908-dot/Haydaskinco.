import { Mail, MessageCircle } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { SOCIAL_URLS } from "@/lib/storefront-copy"
import { getWhatsAppDisplay, whatsAppHref } from "@/lib/whatsapp"

/**
 * The holding page (NEXT_PUBLIC_SITE_HOLDING=1). Server-rendered, no client JS needed, and only
 * contact details the site already publishes: no launch date, no claims.
 */
/** Same simple glyph as the footer's (lucide-react has no brand icons). */
function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 text-rose" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function HoldingPage() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <BrandLogo className="h-14 sm:h-16" priority />
      <h1 className="mt-10 max-w-[22ch] font-serif text-[clamp(1.75rem,1.3rem+1.8vw,2.75rem)] font-normal leading-tight text-navy-deep">
        We&apos;re currently working on the website
      </h1>
      <p className="mt-4 max-w-md text-base text-muted-foreground">
        Ordering is not open yet. If you have a question, we would love to hear from you.
      </p>
      <ul className="mt-10 flex flex-col items-center gap-3 text-sm text-navy-deep sm:flex-row sm:gap-6">
        <li>
          <a href="mailto:hello@haydaskinco.com" className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline">
            <Mail aria-hidden className="size-4 text-rose" /> hello@haydaskinco.com
          </a>
        </li>
        <li>
          <a href={whatsAppHref()} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline">
            <MessageCircle aria-hidden className="size-4 text-rose" /> WhatsApp {getWhatsAppDisplay()}
          </a>
        </li>
        <li>
          <a href={SOCIAL_URLS.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline">
            <InstagramGlyph /> Instagram
          </a>
        </li>
      </ul>
    </main>
  )
}
