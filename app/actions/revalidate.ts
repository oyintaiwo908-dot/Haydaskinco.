"use server"

import { revalidatePath } from "next/cache"
import { hasStoreManagerSession } from "@/lib/admin-access"

/**
 * On-demand cache refresh after admin edits.
 *
 * Storefront catalogue pages are ISR with a 1-hour window (Vercel CPU budget), so
 * these actions are what make admin changes show up immediately. A missed call
 * self-heals when the hour runs out.
 *
 * Server actions are public POST endpoints: every action checks for a store-manager
 * session server-side before doing anything, and returns a result instead of throwing,
 * because the admin's save has already succeeded by the time it is called.
 */
export type RevalidateResult = { ok: true } | { ok: false; error: string }

/*
 * Route-pattern revalidation must use the file path INCLUDING the route group, e.g.
 * "/(storefront)/concern/[concern]": the cache tags Next stores are
 * "_N_T_/(storefront)/concern/[concern]/page". "/concern/[concern]" silently matches nothing.
 * Literal URLs ("/shop", "/product/abc") match the "_N_T_/<url>" tag and need no group.
 */
const UNAUTHORISED: RevalidateResult = { ok: false, error: "Not authorised to refresh the storefront." }

/** Only plain slug/uuid ids become paths; anything else falls back to the route-wide refresh. */
function safeSegment(value?: string | null): string | null {
  if (!value) return null
  return /^[A-Za-z0-9_-]{1,200}$/.test(value) ? value : null
}

export async function revalidateJournal(slug?: string): Promise<RevalidateResult> {
  if (!(await hasStoreManagerSession())) return UNAUTHORISED
  revalidatePath("/journal")
  revalidatePath("/") // home page journal section
  const id = safeSegment(slug)
  if (id) revalidatePath(`/journal/${id}`)
  else revalidatePath("/(storefront)/journal/[slug]", "page")
  return { ok: true }
}

export async function revalidateProducts(productId?: string): Promise<RevalidateResult> {
  if (!(await hasStoreManagerSession())) return UNAUTHORISED
  revalidatePath("/")
  revalidatePath("/shop")
  revalidatePath("/offers")
  revalidatePath("/brands")
  revalidatePath("/(storefront)/concern/[concern]", "page")
  revalidatePath("/(storefront)/ingredient/[ingredient]", "page")
  const id = safeSegment(productId)
  if (id) revalidatePath(`/product/${id}`)
  else revalidatePath("/(storefront)/product/[id]", "page")
  return { ok: true }
}

export async function revalidateDeals(dealId?: string): Promise<RevalidateResult> {
  if (!(await hasStoreManagerSession())) return UNAUTHORISED
  revalidatePath("/deals")
  revalidatePath("/offers")
  revalidatePath("/")
  const id = safeSegment(dealId)
  if (id) revalidatePath(`/deal/${id}`)
  else revalidatePath("/(storefront)/deal/[id]", "page")
  return { ok: true }
}

/** Brand list / name changes: brand directory, home brand strip, shop filters. */
export async function revalidateBrands(): Promise<RevalidateResult> {
  if (!(await hasStoreManagerSession())) return UNAUTHORISED
  revalidatePath("/brands")
  revalidatePath("/")
  revalidatePath("/shop")
  return { ok: true }
}
