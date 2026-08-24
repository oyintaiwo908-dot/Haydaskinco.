/**
 * Rate limiter for API routes.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set;
 * otherwise falls back to an in-memory Map (fine for single-instance / local).
 */

type LimitResult = { ok: true } | { ok: false; retryAfterSec: number }

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_KEYS = 5_000

function prune(now: number) {
  if (buckets.size < MAX_KEYS) return
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key)
  }
  if (buckets.size >= MAX_KEYS) {
    let i = 0
    for (const key of buckets.keys()) {
      buckets.delete(key)
      if (++i >= Math.floor(MAX_KEYS / 2)) break
    }
  }
}

function memoryRateLimit(key: string, limit: number, windowMs: number): LimitResult {
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

function upstashConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  )
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown"
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<LimitResult> {
  if (upstashConfigured()) {
    try {
      const { Ratelimit } = await import("@upstash/ratelimit")
      const { Redis } = await import("@upstash/redis")
      const redis = Redis.fromEnv()
      const windowSec = Math.max(1, Math.ceil(windowMs / 1000))
      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
        prefix: "hayda-rl",
        analytics: false,
      })
      const result = await limiter.limit(key)
      if (result.success) return { ok: true }
      const retryAfterSec = Math.max(
        1,
        Math.ceil((result.reset - Date.now()) / 1000),
      )
      return { ok: false, retryAfterSec }
    } catch (err) {
      console.error("[rate-limit] Upstash failed, using memory:", err)
    }
  }
  return memoryRateLimit(key, limit, windowMs)
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
