import type { MetadataRoute } from "next"
import { SITE_HOLDING } from "@/lib/holding"
import { getSiteUrl } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()

  // Holding page until launch: ask crawlers to stay out entirely.
  if (SITE_HOLDING) return { rules: [{ userAgent: "*", disallow: "/" }] }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/account",
          "/account/",
          "/checkout",
          "/checkout/",
          "/api/",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
