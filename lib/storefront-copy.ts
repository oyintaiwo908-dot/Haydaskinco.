/**
 * Shared storefront copy: the one source for delivery wording.
 *
 * Owner decision: delivery is NOT free and is not charged at checkout. Checkout takes payment
 * for the products only (plus VAT); delivery is quoted and paid separately after the order,
 * and the team contacts the customer to arrange it. Do not promise a fee, a timeframe, a
 * carrier or free delivery anywhere. Change the wording here, not in the pages.
 *
 * Exports:
 * - DELIVERY_SHORT          short line for banners, cards and summaries
 * - DELIVERY_NOTE           full sentence shown before payment and on the review step
 * - DELIVERY_LINE_LABEL     order-summary line value where a shipping price used to be
 * - DELIVERY_EMAIL_LINE     order-confirmation email sentence
 * - ANNOUNCEMENT_MESSAGES   rotating announcement bar
 * - SOCIAL_URLS / SOCIAL_LINKS
 */

export const DELIVERY_SHORT = "Delivery arranged after your order"

export const DELIVERY_NOTE =
  "Delivery is not included in this payment. It is quoted and paid separately after your order, and our team will contact you to arrange it."

export const DELIVERY_LINE_LABEL = "Arranged after order"

export const DELIVERY_EMAIL_LINE = "Our team will be in touch to arrange delivery."

export const SOCIAL_URLS = {
  instagram: "https://instagram.com/haydaskinco",
  tiktok: "https://tiktok.com/@haydaskinco",
  facebook: "https://facebook.com/haydaskinco",
} as const

export const SOCIAL_LINKS = [
  { label: "Instagram" as const, href: SOCIAL_URLS.instagram },
  { label: "TikTok" as const, href: SOCIAL_URLS.tiktok },
  { label: "Facebook" as const, href: SOCIAL_URLS.facebook },
]

export const ANNOUNCEMENT_MESSAGES = [
  // Shown until launch; delete this line when the site is finished.
  "Launching soon. We're still working on the site",
  "Authentic products",
  "Pay securely with Paystack",
  "Combo deals",
] as const
