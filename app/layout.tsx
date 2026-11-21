import type { Metadata, Viewport } from 'next'
import { Geist, Cormorant_Garamond, Geist_Mono } from 'next/font/google'
import { getSiteUrl } from '@/lib/site'
import './globals.css'

// Variable fonts: one file per subset covers every weight in use.
// Geist has no naira glyph (U+20A6) in any subset. Prices render through <Money>
// (components/ui/price.tsx), which sets ₦ in `.currency` with Cormorant: its
// latin-ext file carries the glyph, so the sign never falls back to a system font.
const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})
const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin', 'latin-ext'],
})
// Order references only; not worth a preload.
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  preload: false,
})

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'HAYDA SKINCo. — Hub for all your skin needs',
    template: '%s',
  },
  description:
    'HAYDA SKINCo. is your one-stop destination for premium skincare in Nigeria. Shop trusted brands, serums, moisturisers, sunscreens, and combo deals — authentic products delivered nationwide.',
  keywords: [
    'skincare Nigeria',
    'HAYDA SKINCo',
    'buy skincare online Nigeria',
    'CeraVe Nigeria',
    'The Ordinary Nigeria',
    'La Roche-Posay Nigeria',
    'serums',
    'moisturisers',
    'sunscreens',
    'face toners',
    'skincare deals',
    'authentic skincare',
    'Nigerian skincare store',
    'dermocosmetics',
    'skin barrier',
    'acne skincare',
    'hyperpigmentation',
  ],
  authors: [{ name: 'HAYDA SKINCo.', url: siteUrl }],
  creator: 'HAYDA SKINCo.',
  publisher: 'HAYDA SKINCo.',
  applicationName: 'HAYDA SKINCo.',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: siteUrl,
    siteName: 'HAYDA SKINCo.',
    title: 'HAYDA SKINCo. — Hub for all your skin needs',
    description:
      'Premium skincare for Nigerian skin and climate. Trusted brands, authentic products, and curated deals — delivered nationwide.',
    images: [
      {
        url: '/seo.png',
        width: 1200,
        height: 630,
        alt: 'HAYDA SKINCo. — Premium skincare delivered nationwide',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HAYDA SKINCo. — Hub for all your skin needs',
    description:
      'Premium skincare for Nigerian skin and climate. Trusted brands, authentic products, delivered nationwide.',
    images: ['/seo.png'],
    creator: '@haydaskinco',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
  manifest: '/site.webmanifest',
  alternates: {
    canonical: siteUrl,
  },
  category: 'shopping',
  classification: 'E-commerce — Skincare',
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'HAYDA SKINCo.',
    'mobile-web-app-capable': 'yes',
    'theme-color': '#293049',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  colorScheme: 'light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#293049' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-NG"
      className={`light bg-background ${geist.variable} ${geistMono.variable} ${cormorant.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
