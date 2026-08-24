"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react"
import type { Product } from "@/lib/products"
import { useUserAuth } from "@/components/user-auth-provider"
import {
  addToWishlist,
  fetchWishlistProducts,
  removeFromWishlist,
} from "@/lib/supabase/wishlist"

type FavoritesContextValue = {
  favorites: Product[]
  isFavorited: (id: string) => boolean
  toggleFavorite: (product: Product) => void
  removeFavorite: (id: string) => void
  loading: boolean
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

const LOCAL_KEY = "hayda-favorites-v1"

function readLocal(): Product[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Product[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocal(items: Product[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { session, ready } = useUserAuth()
  const [favorites, setFavorites] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      if (session) {
        const remote = await fetchWishlistProducts()
        if (cancelled) return
        if (remote.length > 0) {
          setFavorites(remote)
          writeLocal(remote)
        } else {
          // Push local guest favourites up once after sign-in
          const local = readLocal()
          if (local.length) {
            await Promise.all(local.map(p => addToWishlist(p.id)))
            const merged = await fetchWishlistProducts()
            if (!cancelled) {
              setFavorites(merged.length ? merged : local)
              writeLocal(merged.length ? merged : local)
            }
          } else if (!cancelled) {
            setFavorites([])
          }
        }
      } else {
        if (!cancelled) setFavorites(readLocal())
      }
      if (!cancelled) {
        setHydrated(true)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [session, ready])

  useEffect(() => {
    if (!hydrated || session) return
    writeLocal(favorites)
  }, [favorites, hydrated, session])

  const isFavorited = useCallback((id: string) => favorites.some(f => f.id === id), [favorites])

  const toggleFavorite = useCallback(async (product: Product) => {
    const exists = favorites.some(f => f.id === product.id)
    setFavorites(prev =>
      exists ? prev.filter(f => f.id !== product.id) : [...prev, product],
    )
    if (session) {
      if (exists) await removeFromWishlist(product.id)
      else await addToWishlist(product.id)
    }
  }, [favorites, session])

  const removeFavorite = useCallback(async (id: string) => {
    setFavorites(prev => prev.filter(f => f.id !== id))
    if (session) await removeFromWishlist(id)
  }, [session])

  const value = useMemo(
    () => ({ favorites, isFavorited, toggleFavorite, removeFavorite, loading }),
    [favorites, isFavorited, toggleFavorite, removeFavorite, loading],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider")
  return ctx
}
