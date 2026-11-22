/** @type {import('next').NextConfig} */

function supabaseHostname() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url) return null
    return new URL(url).hostname
  } catch {
    return null
  }
}

const supabaseHost = supabaseHostname()

/**
 * Content-Security-Policy, shipped as Report-Only first: violations show in the
 * browser console without breaking anything. Switch the header name to
 * `Content-Security-Policy` once a production session shows no violations.
 * 'unsafe-inline' scripts are needed because Next injects inline bootstrap
 * scripts; a nonce-based CSP would force every page to render dynamically.
 */
function contentSecurityPolicy() {
  const supabase = supabaseHost ? `https://${supabaseHost}` : ""
  const supabaseWs = supabaseHost ? `wss://${supabaseHost}` : ""
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabaseWs} https://va.vercel-scripts.com`.replace(/\s+/g, " ").trim(),
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ")
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy() },
]

const nextConfig = {
  // e2e/server.mjs builds a mock-mode copy into its own directory so it never
  // overwrites the real `.next` build. Unset everywhere else.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Dev only: lets a phone on the LAN load the dev server (Next blocks other origins by default).
  // e.g. DEV_ALLOWED_ORIGINS=192.168.1.20 pnpm dev
  ...(process.env.DEV_ALLOWED_ORIGINS
    ? { allowedDevOrigins: process.env.DEV_ALLOWED_ORIGINS.split(",").map(s => s.trim()).filter(Boolean) }
    : {}),
  // Test only (set by e2e/server.mjs for its mock `next dev`): no Turbopack disk cache, so the
  // dev server stops writing in the background while the perf project measures frame rates.
  ...(process.env.E2E_DEV_NO_FS_CACHE === "1" ? { experimental: { turbopackFileSystemCacheForDev: false } } : {}),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
  images: {
    // Skip Vercel Image Optimization (Hobby quota). Serves originals via next/image.
    unoptimized: true,
    qualities: [75, 100],
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
}

export default nextConfig
