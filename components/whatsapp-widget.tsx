"use client"

import { useId, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { X, MessageCircle } from "lucide-react"
import { isCheckoutPath } from "@/components/hide-on-checkout"
import { whatsAppHref } from "@/lib/whatsapp"

const DEFAULT_MESSAGE = "Hi! I'd like to enquire about a product on HAYDA SKINCo."
/** Deep WhatsApp teal: white text on it is 6.2:1 (the brand #25D366 is 2:1, #128C7E 4.1:1). */
const WA_TEAL = "bg-[#0B6E5F]"

function messageForPath(pathname: string) {
  const onProduct = pathname.startsWith("/product/")
  const onDeal = pathname.startsWith("/deal/") || pathname === "/deals" || pathname.startsWith("/deals/")
  if (onProduct || onDeal) {
    return `Hi! I'd like to enquire about ${pathname} on HAYDA SKINCo.`
  }
  return DEFAULT_MESSAGE
}

export function WhatsAppWidget() {
  const pathname = usePathname()
  const [expandedOn, setExpandedOn] = useState<string | null>(null)
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)

  if (isCheckoutPath(pathname)) return null
  // The panel belongs to the page it was opened on; navigating closes it.
  const expanded = expandedOn === pathname
  const href = whatsAppHref(messageForPath(pathname))

  return (
    <div
      className="fixed right-4 z-30 flex flex-col items-end gap-3 transition-[bottom] duration-300 ease-atelier md:right-8"
      style={{ bottom: "calc(1.25rem + var(--fab-lift, 0px) + env(safe-area-inset-bottom))" }}
      onKeyDown={e => {
        if (e.key === "Escape" && expanded) {
          setExpandedOn(null)
          buttonRef.current?.focus()
        }
      }}
    >
      {expanded && (
        <div
          id={panelId}
          role="region"
          aria-label="Chat with HAYDA on WhatsApp"
          className="nav-panel w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-control border border-border bg-background shadow-float"
        >
          <div className={`flex items-center gap-3 px-4 py-3.5 text-white ${WA_TEAL}`}>
            <MessageCircle aria-hidden className="size-5" />
            <div className="flex-1">
              <p className="text-sm font-medium leading-none">HAYDA SKINCo.</p>
              <p className="mt-1 text-xs text-white/90">We reply on WhatsApp</p>
            </div>
          </div>
          <div className="p-4">
            <p className="text-sm leading-relaxed text-foreground">
              Ask us about products, orders or recommendations.
            </p>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-control px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 ${WA_TEAL}`}
            >
              <MessageCircle aria-hidden className="size-4" />
              Open WhatsApp
            </a>
            <p className="mt-2 text-center text-xs text-muted-foreground">Mon–Sat · 8am–8pm WAT</p>
          </div>
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setExpandedOn(expanded ? null : pathname)}
        aria-label={expanded ? "Close WhatsApp chat" : "Chat on WhatsApp"}
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        className={`flex size-14 items-center justify-center rounded-full text-white shadow-float transition-transform duration-200 ease-atelier hover:scale-105 active:scale-95 ${WA_TEAL}`}
      >
        {expanded ? <X aria-hidden className="size-6" /> : <WhatsAppIcon />}
      </button>
    </div>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-7 fill-white" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}
