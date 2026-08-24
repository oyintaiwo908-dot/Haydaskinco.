/**
 * Paystack server helpers (initialize + signature verify).
 */

const PAYSTACK_BASE = "https://api.paystack.co"

export type PaystackInitResult = {
  authorization_url: string
  access_code: string
  reference: string
}

export function isPaystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY?.trim())
}

/**
 * Dev-only offline checkout. Never in production.
 * Never when Paystack secret is set — comment out PAYSTACK_* for local mock.
 * Set ALLOW_MOCK_CHECKOUT=false to force 503 instead of mock when keys are absent.
 */
export function allowMockCheckout() {
  if (process.env.NODE_ENV === "production") return false
  if (isPaystackConfigured()) return false
  return process.env.ALLOW_MOCK_CHECKOUT !== "false"
}

/** Amount in NGN → kobo integer for Paystack */
export function toKobo(ngn: number) {
  return Math.round(ngn * 100)
}

export async function initializeTransaction(input: {
  email: string
  amountNgn: number
  reference: string
  callbackUrl: string
  metadata?: Record<string, unknown>
}): Promise<PaystackInitResult> {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not set")

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: toKobo(input.amountNgn),
      reference: input.reference,
      callback_url: input.callbackUrl,
      currency: "NGN",
      metadata: input.metadata ?? {},
    }),
  })

  const json = await res.json()
  if (!res.ok || !json.status) {
    throw new Error(json.message ?? "Paystack initialize failed")
  }

  return {
    authorization_url: json.data.authorization_url as string,
    access_code: json.data.access_code as string,
    reference: json.data.reference as string,
  }
}

export async function verifyTransaction(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not set")

  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    },
  )
  const json = await res.json()
  if (!res.ok || !json.status) {
    throw new Error(json.message ?? "Paystack verify failed")
  }
  return json.data as {
    status: string
    reference: string
    amount: number
    paid_at?: string
    customer?: { email?: string }
  }
}

/** Verify x-paystack-signature header (HMAC SHA512 of raw body). */
export async function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret || !signature) return false

  const { createHmac, timingSafeEqual } = await import("crypto")
  const hash = createHmac("sha512", secret).update(rawBody).digest("hex")
  try {
    const a = Buffer.from(hash, "utf8")
    const b = Buffer.from(signature, "utf8")
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function generateOrderReference() {
  const stamp = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `HAY-${stamp}-${rand}`
}
