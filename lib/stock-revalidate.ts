import { revalidatePath } from "next/cache"
import { bareDealId, isDealCartId } from "@/lib/deals"

const SAFE_ID = /^[A-Za-z0-9_-]{1,200}$/

/**
 * Refresh the cached pages of everything in a just-paid order, so the stock shown on
 * product pages follows a sale immediately instead of waiting out the 1-hour ISR window.
 * One rebuild per purchased product on its next visit; nothing runs per page view.
 * Server-only: call from route handlers after complete_order_payment succeeds.
 */
export async function revalidateStockForOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  reference: string,
): Promise<void> {
  try {
    const { data } = await db.from("orders").select("items").eq("reference", reference).maybeSingle()
    const items: { productId?: unknown }[] = Array.isArray(data?.items) ? data.items : []
    let hasDeal = false
    for (const item of items) {
      const id = typeof item.productId === "string" ? item.productId : ""
      if (!id) continue
      if (isDealCartId(id)) {
        hasDeal = true
        const dealId = bareDealId(id)
        if (SAFE_ID.test(dealId)) revalidatePath(`/deal/${dealId}`)
      } else if (SAFE_ID.test(id)) {
        revalidatePath(`/product/${id}`)
      }
    }
    // A deal draws stock from its component products; refresh all product pages rather than resolve them.
    // Route-pattern paths need the route group (see app/actions/revalidate.ts).
    if (hasDeal) revalidatePath("/(storefront)/product/[id]", "page")
  } catch (err) {
    console.error("[stock-revalidate]", err)
  }
}
