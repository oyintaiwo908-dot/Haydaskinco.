import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { getSiteUrl } from '@/lib/site'
import './globals.css'

// Self-hosted fonts (app/fonts/, sources and licences in app/fonts/README.md), so builds and
// dev never need Google Fonts. Same files, CSS variables, preloads and metric-matched fallbacks
// as the next/font/google setup they replace.
//
// Family names: next/font/local (Turbopack) names the family in each CSS variable after the JS
// constant, so every @font-face declares that same name (Geist, GeistMono, CormorantGaramond).
// The Cormorant subset and italic calls all declare "CormorantGaramond", so they join one family
// and var(--font-cormorant) reaches all of them; only the main call generates the fallback.
//
// Variable fonts: one file per subset covers every weight in use. Calls that share a family
// name each add @font-face rules with their subset's unicode-range (copied from Google Fonts),
// so a browser only downloads the subsets a page uses. next/font needs literal arguments, so
// the latin / latin-ext ranges are repeated in each call.
// Geist has no naira glyph (U+20A6) in any subset. Prices render through <Money>
// (components/ui/price.tsx), which sets ₦ in `.currency` with Cormorant: its
// latin-ext file carries the glyph, so the sign never falls back to a system font.
const Geist = localFont({
  src: './fonts/geist-latin-var.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--font-geist-sans',
  declarations: [
    { prop: 'font-family', value: "'Geist'" },
    { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  ],
  adjustFontFallback: 'Arial',
})
const CormorantGaramond = localFont({
  src: './fonts/cormorant-garamond-latin-var.woff2',
  weight: '300 700',
  style: 'normal',
  variable: '--font-cormorant',
  declarations: [
    { prop: 'font-family', value: "'CormorantGaramond'" },
    { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  ],
  adjustFontFallback: 'Times New Roman',
})
const CormorantGaramondExt = localFont({
  src: './fonts/cormorant-garamond-latin-ext-var.woff2',
  weight: '300 700',
  style: 'normal',
  variable: '--font-cormorant-ext',
  declarations: [
    { prop: 'font-family', value: "'CormorantGaramond'" },
    { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' },
  ],
  adjustFontFallback: false,
})
// Real italics (they were synthesised before). Not preloaded: italic text is a few headings.
const CormorantGaramondItalic = localFont({
  src: './fonts/cormorant-garamond-italic-latin-var.woff2',
  weight: '300 700',
  style: 'italic',
  variable: '--font-cormorant-italic',
  declarations: [
    { prop: 'font-family', value: "'CormorantGaramond'" },
    { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  ],
  adjustFontFallback: false,
  preload: false,
})
const CormorantGaramondItalicExt = localFont({
  src: './fonts/cormorant-garamond-italic-latin-ext-var.woff2',
  weight: '300 700',
  style: 'italic',
  variable: '--font-cormorant-italic-ext',
  declarations: [
    { prop: 'font-family', value: "'CormorantGaramond'" },
    { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' },
  ],
  adjustFontFallback: false,
  preload: false,
})
// Order references only; not worth a preload.
const GeistMono = localFont({
  src: './fonts/geist-mono-latin-var.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--font-geist-mono',
  declarations: [
    { prop: 'font-family', value: "'GeistMono'" },
    { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  ],
  adjustFontFallback: 'Arial',
  preload: false,
})
const fontVariables = [Geist, GeistMono, CormorantGaramond, CormorantGaramondExt, CormorantGaramondItalic, CormorantGaramondItalicExt]
  .map(f => f.variable)
  .join(' ')

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
      className={`light bg-background ${fontVariables}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
