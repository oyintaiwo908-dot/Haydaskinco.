/**
 * Lightweight in-memory rate limiter for API routes.
 * Best-effort on serverless (per-instance); still blocks obvious spam bursts.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

const MAX_KEYS = 5_000

function prune(now: number) {
  if (buckets.size < MAX_KEYS) return
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key)
  }
  if (buckets.size >= MAX_KEYS) {
    // Drop oldest half if still full
    let i = 0
    for (const key of buckets.keys()) {
      buckets.delete(key)
      if (++i >= Math.floor(MAX_KEYS / 2)) break
    }
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown"
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  prune(now)
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }
  existing.count += 1
  return { ok: true }
}

export function rateLimitResponse(retryAfterSec: number) {
  return new Response(JSON.stringify({ error: "Too many requests. Try again shortly." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSec),
    },
  })
}
