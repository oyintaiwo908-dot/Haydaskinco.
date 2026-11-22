import { getSiteUrl } from "@/lib/site"
import { DELIVERY_EMAIL_LINE } from "@/lib/storefront-copy"

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function naira(n: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(n)
}

const BRAND = {
  ink: "#293049",
  crimson: "#FACBD3",
  cream: "#FDF0F3",
  white: "#FFFFFF",
  muted: "#6B7280",
  line: "#F0B8C3",
  softInk: "#3D4A66",
}

/** Resolve relative public paths to absolute URLs for email clients. */
function absUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return `${getSiteUrl()}/placeholder.svg`
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`
  return `${getSiteUrl()}${path}`
}

function logoUrl(): string {
  return absUrl("/logo.png")
}

function shopUrl(path = "/shop"): string {
  return absUrl(path.startsWith("/") ? path : `/${path}`)
}

function ctaButton(label: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 8px;">
    <tr>
      <td style="background:${BRAND.ink};">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:15px 30px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;text-decoration:none;color:${BRAND.white};">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`
}

function promoBlock(code: string, caption?: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:22px 0;">
    <tr>
      <td style="background:${BRAND.crimson};border:1px solid ${BRAND.line};padding:26px 20px;text-align:center;">
        ${caption ? `<p style="margin:0 0 10px;font-family:system-ui,-apple-system,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.ink};font-weight:600;">${escapeHtml(caption)}</p>` : ""}
        <p style="margin:0;font-family:system-ui,-apple-system,sans-serif;font-size:28px;letter-spacing:0.2em;font-weight:700;color:${BRAND.ink};">
          ${escapeHtml(code)}
        </p>
      </td>
    </tr>
  </table>`
}

/** Full-bleed visual hero under the logo header. */
function heroBand(opts: {
  image: string
  eyebrow: string
  title: string
  subtitle?: string
}): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td background="${escapeHtml(absUrl(opts.image))}" bgcolor="${BRAND.ink}" style="background-color:${BRAND.ink};background-image:url('${escapeHtml(absUrl(opts.image))}');background-size:cover;background-position:center;">
        <!--[if gte mso 9]>
        <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:220px;">
          <v:fill type="frame" src="${escapeHtml(absUrl(opts.image))}" color="${BRAND.ink}" />
          <v:textbox inset="0,0,0,0">
        <![endif]-->
        <div style="background:linear-gradient(180deg,rgba(41,48,73,0.35) 0%,rgba(41,48,73,0.88) 100%);">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="padding:48px 32px 40px;text-align:left;">
                <p style="margin:0 0 10px;font-family:system-ui,-apple-system,sans-serif;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:${BRAND.crimson};font-weight:600;">
                  ${escapeHtml(opts.eyebrow)}
                </p>
                <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;font-weight:500;color:${BRAND.white};">
                  ${escapeHtml(opts.title)}
                </h1>
                ${
                  opts.subtitle
                    ? `<p style="margin:12px 0 0;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.82);max-width:420px;">${escapeHtml(opts.subtitle)}</p>`
                    : ""
                }
              </td>
            </tr>
          </table>
        </div>
        <!--[if gte mso 9]>
          </v:textbox>
        </v:rect>
        <![endif]-->
      </td>
    </tr>
  </table>`
}

/** Three lifestyle / product tiles for welcome & promotional emails. */
function collectionStrip(images: { src: string; label: string }[]): string {
  const cells = images
    .map(
      img => `<td width="33.33%" valign="top" style="padding:4px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${BRAND.cream};">
          <tr>
            <td style="padding:10px;text-align:center;">
              <img src="${escapeHtml(absUrl(img.src))}" alt="${escapeHtml(img.label)}" width="140" style="display:block;margin:0 auto;width:100%;max-width:140px;height:auto;border:0;" />
              <p style="margin:10px 0 0;font-family:system-ui,-apple-system,sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.ink};font-weight:600;">
                ${escapeHtml(img.label)}
              </p>
            </td>
          </tr>
        </table>
      </td>`,
    )
    .join("")

  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:8px 0 24px;">
    <tr>${cells}</tr>
  </table>`
}

function statusPill(label: string): string {
  return `<span style="display:inline-block;padding:6px 12px;background:${BRAND.crimson};color:${BRAND.ink};font-family:system-ui,-apple-system,sans-serif;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;">
    ${escapeHtml(label)}
  </span>`
}

function productRows(items: OrderEmailItem[]): string {
  return items
    .map(i => {
      const img = absUrl(i.image || "/placeholder.svg")
      return `<tr>
        <td style="padding:16px 0;border-bottom:1px solid ${BRAND.line};">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td width="72" valign="top" style="padding-right:14px;">
                <img src="${escapeHtml(img)}" alt="${escapeHtml(i.name)}" width="64" height="64" style="display:block;width:64px;height:64px;object-fit:cover;border:1px solid ${BRAND.line};background:${BRAND.cream};" />
              </td>
              <td valign="middle" style="font-family:system-ui,-apple-system,sans-serif;">
                <p style="margin:0;font-size:14px;font-weight:600;color:${BRAND.ink};line-height:1.4;">${escapeHtml(i.name)}</p>
                <p style="margin:6px 0 0;font-size:12px;color:${BRAND.muted};">Qty ${i.quantity}</p>
              </td>
              <td width="90" valign="middle" align="right" style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:600;color:${BRAND.ink};white-space:nowrap;">
                ${naira(i.price * i.quantity)}
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    })
    .join("")
}

function layout(
  title: string,
  body: string,
  opts?: { preheader?: string; hero?: string },
): string {
  const preheader = opts?.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        ${escapeHtml(opts.preheader)}
      </div>`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};font-family:Georgia,'Times New Roman',serif;color:${BRAND.ink};">
  ${preheader}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${BRAND.cream};padding:36px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;">
          <tr><td style="height:5px;background:${BRAND.ink};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td style="height:4px;background:${BRAND.crimson};font-size:0;line-height:0;">&nbsp;</td></tr>

          <tr>
            <td style="background:${BRAND.white};border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};">
              <!-- Logo header -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:22px 28px;text-align:center;background:${BRAND.white};">
                    <a href="${escapeHtml(getSiteUrl())}" style="text-decoration:none;">
                      <img src="${escapeHtml(logoUrl())}" alt="HAYDA SKINCo." width="128" style="display:block;margin:0 auto;width:128px;max-width:55%;height:auto;border:0;" />
                    </a>
                  </td>
                </tr>
              </table>

              ${opts?.hero ?? ""}

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:32px 28px 16px;">
                    ${body}
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:28px;border-top:1px solid ${BRAND.line};background:${BRAND.cream};text-align:center;">
                    <img src="${escapeHtml(logoUrl())}" alt="" width="72" style="display:block;margin:0 auto 14px;width:72px;height:auto;border:0;opacity:0.85;" />
                    <p style="margin:0 0 10px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;line-height:1.6;color:${BRAND.muted};">
                      Questions? Reply to this email or WhatsApp us.
                    </p>
                    <p style="margin:0;font-family:system-ui,-apple-system,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.ink};">
                      <a href="${escapeHtml(shopUrl())}" style="color:${BRAND.ink};text-decoration:none;">Shop</a>
                      &nbsp;·&nbsp;
                      <a href="${escapeHtml(shopUrl("/offers"))}" style="color:${BRAND.ink};text-decoration:none;">Offers</a>
                      &nbsp;·&nbsp;
                      <a href="${escapeHtml(shopUrl("/account"))}" style="color:${BRAND.ink};text-decoration:none;">Account</a>
                      &nbsp;·&nbsp;
                      <a href="${escapeHtml(shopUrl("/contact"))}" style="color:${BRAND.ink};text-decoration:none;">Contact</a>
                    </p>
                    <p style="margin:16px 0 0;font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:${BRAND.muted};">
                      © ${new Date().getFullYear()} HAYDA SKINCo. · Nigeria
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:5px;background:${BRAND.ink};font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:400;line-height:1.7;color:${BRAND.muted};">
    ${html}
  </p>`
}

export type OrderEmailItem = {
  name: string
  quantity: number
  price: number
  image?: string
}

export function orderConfirmationHtml(opts: {
  name: string
  reference: string
  items: OrderEmailItem[]
  total: number
  /** Kept for callers; delivery is no longer priced or timed at checkout. */
  shippingMethod: string
}): string {
  const firstImage = opts.items.find(i => i.image)?.image || "/product-serum.png"

  return layout(
    "Order confirmation",
    `${statusPill("Payment received")}
     <h2 style="margin:16px 0 12px;font-size:24px;line-height:1.25;font-weight:500;color:${BRAND.ink};">
       Thank you, ${escapeHtml(opts.name)}
     </h2>
     ${paragraph(
       `We’ve confirmed order <strong style="color:${BRAND.ink};">${escapeHtml(opts.reference)}</strong>.
        ${escapeHtml(DELIVERY_EMAIL_LINE)}`,
     )}
     <p style="margin:24px 0 8px;font-family:system-ui,-apple-system,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.ink};font-weight:700;">
       Your items
     </p>
     <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
       ${productRows(opts.items)}
       <tr>
         <td style="padding:18px 0 0;">
           <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
             <tr>
               <td style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.muted};">Total paid</td>
               <td align="right" style="font-family:Georgia,serif;font-size:24px;font-weight:500;color:${BRAND.ink};">${naira(opts.total)}</td>
             </tr>
           </table>
         </td>
       </tr>
     </table>
     ${ctaButton("View your orders", shopUrl("/account/orders"))}`,
    {
      preheader: `Order ${opts.reference} confirmed — total ${naira(opts.total)}`,
      hero: heroBand({
        image: firstImage,
        eyebrow: "Order confirmed",
        title: "Your order is confirmed",
        subtitle: "We’re preparing your parcel with care.",
      }),
    },
  )
}

export function orderShippedHtml(opts: {
  name: string
  reference: string
  items?: OrderEmailItem[]
}): string {
  const previewItems = (opts.items ?? []).slice(0, 3)
  const itemStrip =
    previewItems.length > 0
      ? `<p style="margin:20px 0 8px;font-family:system-ui,-apple-system,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.ink};font-weight:700;">In this parcel</p>
         <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${productRows(previewItems)}</table>`
      : ""

  return layout(
    "Your order has shipped",
    `${statusPill("Shipped")}
     <h2 style="margin:16px 0 12px;font-size:24px;line-height:1.25;font-weight:500;color:${BRAND.ink};">
       On its way to you
     </h2>
     ${paragraph(
       `Hi ${escapeHtml(opts.name)}, order <strong style="color:${BRAND.ink};">${escapeHtml(opts.reference)}</strong> has left our care.
        You’ll hear from us again when it’s delivered.`,
     )}
     ${itemStrip}
     ${ctaButton("Track in your account", shopUrl("/account/orders"))}`,
    {
      preheader: `Order ${opts.reference} has shipped`,
      hero: heroBand({
        image: "/brand-story.png",
        eyebrow: "Shipping update",
        title: "Your parcel is moving",
        subtitle: "Authentically packed. Carefully sent.",
      }),
    },
  )
}

export function orderFulfilledHtml(opts: {
  name: string
  reference: string
  items?: OrderEmailItem[]
}): string {
  const previewItems = (opts.items ?? []).slice(0, 3)
  const itemStrip =
    previewItems.length > 0
      ? `<p style="margin:20px 0 8px;font-family:system-ui,-apple-system,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.ink};font-weight:700;">What you received</p>
         <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${productRows(previewItems)}</table>`
      : ""

  return layout(
    "Order delivered",
    `${statusPill("Delivered")}
     <h2 style="margin:16px 0 12px;font-size:24px;line-height:1.25;font-weight:500;color:${BRAND.ink};">
       It’s with you
     </h2>
     ${paragraph(
       `Hi ${escapeHtml(opts.name)}, order <strong style="color:${BRAND.ink};">${escapeHtml(opts.reference)}</strong> has been marked as delivered.
        We hope you love every product — leave a review from your account anytime.`,
     )}
     ${itemStrip}
     ${ctaButton("Leave a review", shopUrl("/account/reviews"))}`,
    {
      preheader: `Order ${opts.reference} delivered`,
      hero: heroBand({
        image: "/hero-skincare.png",
        eyebrow: "Delivered",
        title: "Rewards unlocked",
        subtitle: "Your skincare has arrived. Make it yours.",
      }),
    },
  )
}

export function welcomeHtml(opts: { name: string }): string {
  return layout(
    "Welcome to HAYDA SKINCo.",
    `${statusPill("Welcome")}
     <h2 style="margin:16px 0 12px;font-size:24px;line-height:1.25;font-weight:500;color:${BRAND.ink};">
       Hello, ${escapeHtml(opts.name)}
     </h2>
     ${paragraph(
       `Your account is ready. Shop curated skincare, earn loyalty points on every paid order
        (1 point per ₦100), and redeem rewards anytime.`,
     )}
     ${collectionStrip([
       { src: "/serum.jpeg", label: "Serums" },
       { src: "/moisturizer.jpeg", label: "Moisturisers" },
       { src: "/sunscreen.jpeg", label: "SPF" },
     ])}
     <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 8px;background:${BRAND.crimson};">
       <tr>
         <td style="padding:20px 22px;">
           <p style="margin:0;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.65;color:${BRAND.ink};">
             <strong>HAYDA Rewards</strong> — earn on every purchase, redeem for discounts and member perks.
           </p>
         </td>
       </tr>
     </table>
     ${ctaButton("Start shopping", shopUrl())}`,
    {
      preheader: "Your HAYDA SKINCo. account is ready",
      hero: heroBand({
        image: "/product-cream.png",
        eyebrow: "You’re in",
        title: "Welcome to the HAYDA family",
        subtitle: "Premium skincare for Nigerian skin and climate.",
      }),
    },
  )
}

export function rewardPromoHtml(opts: {
  name: string
  promoCode: string
  discountNgn: number
}): string {
  return layout(
    "Your reward code",
    `${statusPill("Rewards")}
     <h2 style="margin:16px 0 12px;font-size:24px;line-height:1.25;font-weight:500;color:${BRAND.ink};">
       Reward unlocked
     </h2>
     ${paragraph(
       `Hi ${escapeHtml(opts.name)}, here’s your promo code for
        <strong style="color:${BRAND.ink};">${naira(opts.discountNgn)} off</strong>:`,
     )}
     ${promoBlock(opts.promoCode, "Your code")}
     ${collectionStrip([
       { src: "/toner.jpeg", label: "Toners" },
       { src: "/serum.jpeg", label: "Serums" },
       { src: "/sunscreen.jpeg", label: "Sunscreen" },
     ])}
     ${paragraph("Use it at checkout before it expires.")}
     ${ctaButton("Shop with your code", shopUrl())}`,
    {
      preheader: `Your ${naira(opts.discountNgn)} reward code: ${opts.promoCode}`,
      hero: heroBand({
        image: "/product-oil.png",
        eyebrow: "Member perk",
        title: "Treat yourself",
        subtitle: `${naira(opts.discountNgn)} waiting for your next order.`,
      }),
    },
  )
}

export function newsletterWelcomeHtml(opts: { promoCode: string }): string {
  return layout(
    "You're on the list",
    `${statusPill("The HAYDA List")}
     <h2 style="margin:16px 0 12px;font-size:24px;line-height:1.25;font-weight:500;color:${BRAND.ink};">
       You’re in
     </h2>
     ${paragraph(
       `Thanks for subscribing. Here’s <strong style="color:${BRAND.ink};">10% off</strong> your first order.`,
     )}
     ${promoBlock(opts.promoCode, "Welcome offer")}
     ${collectionStrip([
       { src: "/sunscreen.jpeg", label: "SPF" },
       { src: "/moisturizer.jpeg", label: "Body" },
       { src: "/serum.jpeg", label: "Actives" },
     ])}
     ${ctaButton("Redeem at checkout", shopUrl())}`,
    {
      preheader: `Your 10% off code: ${opts.promoCode}`,
      hero: heroBand({
        image: "/journal-glow.png",
        eyebrow: "Subscriber perk",
        title: "A welcome gift from us",
        subtitle: "Exclusive drops, rewards, and offers in your inbox.",
      }),
    },
  )
}

export function contactNotifyHtml(opts: {
  name: string
  email: string
  subject: string
  message: string
}): string {
  return layout(
    "New contact message",
    `${statusPill("Inbox")}
     <h2 style="margin:16px 0 14px;font-size:22px;line-height:1.25;font-weight:500;color:${BRAND.ink};">
       New contact message
     </h2>
     <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 18px;background:${BRAND.cream};border:1px solid ${BRAND.line};">
       <tr>
         <td style="padding:20px 22px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.7;color:${BRAND.ink};">
           <p style="margin:0 0 8px;"><strong>From:</strong> ${escapeHtml(opts.name)} &lt;${escapeHtml(opts.email)}&gt;</p>
           <p style="margin:0;"><strong>Subject:</strong> ${escapeHtml(opts.subject || "(none)")}</p>
         </td>
       </tr>
     </table>
     <p style="margin:0;font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:400;line-height:1.7;color:${BRAND.muted};white-space:pre-wrap;">${escapeHtml(opts.message)}</p>`,
    {
      preheader: `Contact from ${opts.name}: ${opts.subject || "new message"}`,
      hero: heroBand({
        image: "/product-toner.png",
        eyebrow: "Admin alert",
        title: "Someone reached out",
        subtitle: "A new message landed in your contact inbox.",
      }),
    },
  )
}

export function wholesaleNotifyHtml(opts: {
  name: string
  business: string
  email: string
  phone: string
  type: string
  volume: string
  message: string
}): string {
  const fields: [string, string][] = [
    ["Name", opts.name],
    ["Business", opts.business],
    ["Email", opts.email],
    ["Phone", opts.phone],
    ["Type", opts.type],
    ["Volume", opts.volume || "—"],
  ]

  const fieldRows = fields
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:10px 0;border-bottom:1px solid ${BRAND.line};font-family:system-ui,-apple-system,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.muted};width:30%;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:10px 0;border-bottom:1px solid ${BRAND.line};font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:${BRAND.ink};">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("")

  return layout(
    "Wholesale enquiry",
    `${statusPill("Wholesale")}
     <h2 style="margin:16px 0 14px;font-size:22px;line-height:1.25;font-weight:500;color:${BRAND.ink};">
       New enquiry
     </h2>
     <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px;">
       ${fieldRows}
     </table>
     ${
       opts.message
         ? `<p style="margin:0;font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:400;line-height:1.7;color:${BRAND.muted};white-space:pre-wrap;">${escapeHtml(opts.message)}</p>`
         : ""
     }`,
    {
      preheader: `Wholesale enquiry from ${opts.business}`,
      hero: heroBand({
        image: "/brand-story.png",
        eyebrow: "B2B lead",
        title: opts.business || "Wholesale interest",
        subtitle: "A retailer or salon wants to partner with HAYDA.",
      }),
    },
  )
}
