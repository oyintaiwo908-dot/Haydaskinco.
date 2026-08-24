"use client"

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import type { Product } from "@/lib/products"
import { getProductMoq, getUnitPriceForQuantity } from "@/lib/products"
import { useUserAuth } from "@/components/user-auth-provider"
import {
  clearCartItems,
  fetchCartItems,
  mergeGuestCartIntoServer,
  removeCartItem,
  upsertCartItem,
  type CartItem,
} from "@/lib/supabase/cart"
import {
  evaluateCartStock,
  fetchLiveStock,
  hasBlockingStockIssues,
  type StockAvailability,
} from "@/lib/supabase/cart-stock"

export type { CartItem }

type CartContextValue = {
  items: CartItem[]
  count: number
  subtotal: number
  lastAdded: string | null
  isOpen: boolean
  loading: boolean
  /** Live stock status keyed by product id (after refreshAvailability). */
  stockById: Record<string, StockAvailability>
  hasStockIssues: boolean
  stockChecking: boolean
  openCart: () => void
  closeCart: () => void
  /** Add product; optional quantity (defaults to product MOQ on first add, +1 when already in cart). */
  addItem: (product: Product, quantity?: number) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  refreshAvailability: () => Promise<boolean>
}

const CartContext = createContext<CartContextValue | null>(null)

/** Guest-only scratch pad until sign-in (then merged into DB and cleared). */
const GUEST_KEY = "hayda-cart-guest-v1"

function readGuestCart(): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CartItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(i => i && typeof i.id === "string" && Number(i.quantity) > 0)
  } catch {
    return []
  }
}

function writeGuestCart(items: CartItem[]) {
  try {
    if (!items.length) localStorage.removeItem(GUEST_KEY)
    else localStorage.setItem(GUEST_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { session } = useUserAuth()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lastAdded, setLastAdded] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [stockById, setStockById] = useState<Record<string, StockAvailability>>({})
  const [stockChecking, setStockChecking] = useState(false)
  const syncReady = useRef(false)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const refreshAvailability = useCallback(async () => {
    const current = itemsRef.current
    if (!current.length) {
      setStockById({})
      return false
    }
    setStockChecking(true)
    try {
      const live = await fetchLiveStock(current.map(i => i.id))
      const evaluated = evaluateCartStock(current, live)
      const statusById: Record<string, StockAvailability> = {}
      for (const row of evaluated) statusById[row.productId] = row

      // Clamp qty when limited (keep OOS lines so the user can see / remove them)
      const nextItems = current.map(item => {
        const status = statusById[item.id]
        if (!status) return item
        let nextQty = item.quantity
        if (!status.unavailable && status.exceeds) {
          nextQty = Math.max(1, status.available)
          if (session && nextQty !== item.quantity) {
            void upsertCartItem(item, nextQty)
          }
        }
        return { ...item, stock: status.stock, quantity: nextQty }
      })

      const afterClamp = evaluateCartStock(nextItems, live)
      const map: Record<string, StockAvailability> = {}
      for (const row of afterClamp) map[row.productId] = row
      setStockById(map)
      setItems(nextItems)

      return hasBlockingStockIssues(afterClamp)
    } finally {
      setStockChecking(false)
    }
  }, [session])

  // Hydrate from Supabase when signed in; guest cart only while signed out
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      syncReady.current = false
      if (session) {
        const guest = readGuestCart()
        const merged = guest.length
          ? await mergeGuestCartIntoServer(guest)
          : await fetchCartItems()
        if (guest.length) writeGuestCart([])
        try { localStorage.removeItem("hayda-cart-v1") } catch { /* ignore */ }
        if (!cancelled) setItems(merged)
      } else {
        if (!cancelled) setItems(readGuestCart())
      }
      if (!cancelled) {
        syncReady.current = true
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [session])

  // Persist guest cart only (signed-in cart is written on each mutation)
  useEffect(() => {
    if (!syncReady.current || session) return
    writeGuestCart(items)
  }, [items, session])

  // Refresh stock when cart opens or items change while open
  useEffect(() => {
    if (!isOpen || !items.length) return
    void refreshAvailability()
  }, [isOpen, items.length, refreshAvailability])

  const addItem = useCallback((product: Product, quantity?: number) => {
    if (!product.id.startsWith("deal__") && product.stock <= 0) return

    const moq = product.id.startsWith("deal__") ? 1 : getProductMoq(product)
    // base = catalog base; sku = selected variant absolute (or base)
    const basePrice = product.listPrice ?? product.price
    const skuPrice = product.skuPrice ?? basePrice

    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      const delta = quantity != null
        ? Math.max(1, Math.floor(quantity))
        : existing
          ? 1
          : moq
      let nextQty = (existing?.quantity ?? 0) + delta
      if (!existing) nextQty = Math.max(moq, nextQty)

      if (!product.id.startsWith("deal__") && product.stock > 0 && nextQty > product.stock) {
        return prev
      }

      const unit = getUnitPriceForQuantity(
        {
          price: basePrice,
          listPrice: basePrice,
          skuPrice,
          priceTiers: product.priceTiers,
          discountPct: product.discountPct,
        },
        nextQty,
      )
      const toAdd = {
        ...product,
        listPrice: basePrice,
        skuPrice,
        moq,
        priceTiers: product.priceTiers,
        discountPct: product.discountPct,
        price: unit,
      }

      if (session) void upsertCartItem(toAdd, nextQty)

      return existing
        ? prev.map((item) =>
            item.id === toAdd.id ? { ...item, ...toAdd, quantity: nextQty } : item,
          )
        : [...prev, { ...toAdd, quantity: nextQty }]
    })
    setLastAdded(product.id)
  }, [session])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    setStockById(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (session) void removeCartItem(id)
  }, [session])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) => {
      const current = prev.find((item) => item.id === id)
      if (!current) return prev

      const moq = id.startsWith("deal__") ? 1 : getProductMoq(current)

      if (quantity < 1) {
        if (session) void removeCartItem(id)
        return prev.filter((item) => item.id !== id)
      }

      // Below MOQ → remove line (user is backing out of the minimum)
      if (quantity < moq) {
        if (session) void removeCartItem(id)
        return prev.filter((item) => item.id !== id)
      }

      const status = stockById[id]
      const max = status && !status.unavailable
        ? status.available
        : current.stock > 0
          ? current.stock
          : quantity
      const capped = Math.min(quantity, Math.max(moq, max || quantity))

      const basePrice = current.listPrice ?? current.price
      const skuPrice = current.skuPrice ?? basePrice
      const unit = getUnitPriceForQuantity(
        {
          price: basePrice,
          listPrice: basePrice,
          skuPrice,
          priceTiers: current.priceTiers,
          discountPct: current.discountPct,
        },
        capped,
      )
      const updated = {
        ...current,
        listPrice: basePrice,
        skuPrice,
        price: unit,
        quantity: capped,
      }

      if (session) void upsertCartItem(updated, capped)
      return prev.map((item) => (item.id === id ? updated : item))
    })
  }, [session, stockById])

  const clearCart = useCallback(() => {
    setItems([])
    setLastAdded(null)
    setStockById({})
    if (session) void clearCartItems()
    else writeGuestCart([])
  }, [session])

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  const count = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items])
  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const status = stockById[item.id]
        if (status?.unavailable) return sum
        const basePrice = item.listPrice ?? item.price
        const skuPrice = item.skuPrice ?? basePrice
        const unit = getUnitPriceForQuantity(
          {
            price: basePrice,
            listPrice: basePrice,
            skuPrice,
            priceTiers: item.priceTiers,
            discountPct: item.discountPct,
          },
          item.quantity,
        )
        return sum + unit * item.quantity
      }, 0),
    [items, stockById],
  )
  const hasStockIssues = useMemo(
    () => Object.values(stockById).some(s => s.unavailable || s.exceeds),
    [stockById],
  )

  const value = useMemo(
    () => ({
      items,
      count,
      subtotal,
      lastAdded,
      isOpen,
      loading,
      stockById,
      hasStockIssues,
      stockChecking,
      openCart,
      closeCart,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      refreshAvailability,
    }),
    [
      items, count, subtotal, lastAdded, isOpen, loading, stockById, hasStockIssues, stockChecking,
      openCart, closeCart, addItem, removeItem, updateQuantity, clearCart, refreshAvailability,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}
