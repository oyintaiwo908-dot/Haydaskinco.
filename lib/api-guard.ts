/**
 * Small helpers for route handlers: bounded JSON parsing, field validation,
 * same-origin checks for cookie-authenticated POSTs, and error responses that
 * never echo database / provider internals to the client.
 */
import { NextResponse } from "next/server"

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
  }
}

/** Parse a JSON object body, rejecting oversized or non-object payloads. */
export async function readJsonObject(
  request: Request,
  maxBytes = 16_000,
): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length") ?? "0")
  if (declared > maxBytes) throw new ValidationError("Request body is too large.")

  const text = await request.text()
  if (text.length > maxBytes) throw new ValidationError("Request body is too large.")

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ValidationError("Invalid JSON body.")
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ValidationError("Invalid JSON body.")
  }
  return parsed as Record<string, unknown>
}

/**
 * Read an optional string field: trimmed, "" when absent.
 * Throws when the value is not a string or exceeds `max` characters.
 */
export function stringField(
  body: Record<string, unknown>,
  key: string,
  max: number,
  label = key,
): string {
  const value = body[key]
  if (value == null) return ""
  if (typeof value !== "string") throw new ValidationError(`${label} must be text.`)
  const trimmed = value.trim()
  if (trimmed.length > max) {
    throw new ValidationError(`${label} must be at most ${max} characters.`)
  }
  return trimmed
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

/** Map a thrown error to a response: validation errors are shown, anything else is logged and hidden. */
export function errorResponse(tag: string, err: unknown, publicMessage = "Something went wrong.") {
  if (err instanceof ValidationError) return jsonError(err.message, 400)
  console.error(`[${tag}]`, err)
  return jsonError(publicMessage, 500)
}

/**
 * CSRF defence in depth for cookie-authenticated routes (session cookies are
 * SameSite=Lax already). Browsers always send Origin on cross-site POSTs; when
 * present it must match the request host. Non-browser callers without Origin
 * are allowed because they cannot ride a victim's cookies.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return true
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  if (!host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export function forbiddenOrigin() {
  return jsonError("Forbidden.", 403)
}
