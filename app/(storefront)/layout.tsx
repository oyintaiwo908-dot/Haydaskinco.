import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { CartProvider } from '@/components/cart-provider'
import { FavoritesProvider } from '@/components/favorites-provider'
import { UserAuthProvider } from '@/components/user-auth-provider'
import { SiteNavbar } from '@/components/site-navbar'
import { SiteFooter } from '@/components/site-footer'
import { CartDrawer } from '@/components/cart-drawer'
import { SearchModal, SearchProvider } from '@/components/search-modal'
import { AnnouncementBar } from '@/components/announcement-bar'
import { WhatsAppWidget } from '@/components/whatsapp-widget'
import { NewsletterPopup } from '@/components/newsletter-popup'
import { HideOnCheckout } from '@/components/hide-on-checkout'
import { ViewTransition } from '@/components/motion/view-transition'
import { HoldingGate } from '@/components/holding-gate'
import { HoldingPage } from '@/components/holding-page'
import { SITE_HOLDING } from '@/lib/holding'

/** While the holding page is on, nothing in the storefront is indexed. */
export const metadata: Metadata = SITE_HOLDING ? { robots: { index: false, follow: false } } : {}

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const storefront = (
    <UserAuthProvider>
    <CartProvider>
      <FavoritesProvider>
        <SearchProvider>
          <a href="#main" className="skip-link">Skip to content</a>
          {/* Persistent live region for add-to-cart and favourite announcements (components/motion/fly-to-bag.ts). */}
          <div id="site-announcer" role="status" aria-live="polite" className="sr-only" />
          <div className="flex min-h-screen flex-col bg-background">
            {/* Checkout gets a distraction-free shell; it renders its own minimal header. */}
            <HideOnCheckout>
              <AnnouncementBar />
              <SiteNavbar />
            </HideOnCheckout>
            <main id="main" tabIndex={-1} className="flex-1 overflow-x-clip outline-none">
              {/* Page swap animates on navigation (globals.css "View transitions"); product images morph. */}
              <ViewTransition name="page">
                <div>{children}</div>
              </ViewTransition>
            </main>
            <HideOnCheckout>
              <SiteFooter />
            </HideOnCheckout>
          </div>
          <CartDrawer />
          <SearchModal />
          <WhatsAppWidget />
          <NewsletterPopup />
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </SearchProvider>
      </FavoritesProvider>
    </CartProvider>
    </UserAuthProvider>
  )

  // Holding page until launch (NEXT_PUBLIC_SITE_HOLDING=1): the server HTML is the holding page;
  // the real storefront renders only in team preview mode (components/holding-gate.tsx).
  if (SITE_HOLDING) return <HoldingGate holding={<HoldingPage />}>{storefront}</HoldingGate>
  return storefront
}
