"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createAdminBrowserClient } from "@/lib/supabase/client"
import {
  type AdminSession,
  getAdminSession,
  saveAdminSession,
  clearAdminSession,
  supabaseSessionToAdminSession,
} from "@/lib/auth"

/* ─── Context ────────────────────────────────────────────────── */
type AdminAuthCtx = {
  session: AdminSession | null
  /** Returns an error string on failure, null on success */
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => void
}

const AdminAuthContext = createContext<AdminAuthCtx>({
  session: null,
  signIn: async () => "Not initialised",
  signOut: () => {},
})

export function useAdminAuth() {
  return useContext(AdminAuthContext)
}

/* ─── Provider + guard ───────────────────────────────────────── */
export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const supabase = createAdminBrowserClient()

    if (!supabase) {
      // Dev-only mock — never in production
      if (process.env.NODE_ENV === "production") {
        setChecked(true)
        router.replace("/admin/login")
        return
      }
      const s = getAdminSession()
      setSession(s)
      setChecked(true)
      if (!s) router.replace("/admin/login")
      return
    }

    // Supabase is live — never trust leftover mock localStorage sessions
    clearAdminSession()

    // Supabase path: check current session
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!s) {
        setChecked(true)
        router.replace("/admin/login")
        return
      }

      // Verify role + suspension in profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_suspended")
        .eq("id", s.user.id)
        .single()

      if (!profile || profile.role !== "admin" || profile.is_suspended) {
        await supabase.auth.signOut()
        setChecked(true)
        router.replace("/admin/login")
        return
      }

      setSession(supabaseSessionToAdminSession(s))
      setChecked(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!s) {
        setSession(null)
        router.replace("/admin/login")
        return
      }
      // Re-check role on auth change
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_suspended")
        .eq("id", s.user.id)
        .single()

      if (!profile || profile.role !== "admin" || profile.is_suspended) {
        await supabase.auth.signOut()
        setSession(null)
        return
      }
      setSession(supabaseSessionToAdminSession(s))
    })

    return () => subscription.unsubscribe()
  }, [router])

  /* ── signIn ── */
  async function signIn(email: string, password: string): Promise<string | null> {
    const supabase = createAdminBrowserClient()

    if (!supabase) {
      if (process.env.NODE_ENV === "production") {
        return "Admin auth is not configured."
      }
      // Mock path (local only)
      await new Promise(r => setTimeout(r, 800))
      if (email === "admin@haydaskinco.com" && password === "password") {
        const s: AdminSession = { email, name: "Admin", signedInAt: Date.now() }
        saveAdminSession(s)
        setSession(s)
        return null
      }
      return "Invalid email or password. Try admin@haydaskinco.com / password"
    }

    clearAdminSession()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message

    // Check admin role + suspension
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_suspended")
      .eq("id", data.user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      await supabase.auth.signOut()
      return "Access denied. This account does not have admin privileges."
    }
    if (profile.is_suspended) {
      await supabase.auth.signOut()
      return "This account has been suspended."
    }

    setSession(supabaseSessionToAdminSession(data.session))
    return null
  }

  /* ── signOut ── */
  function signOut() {
    const supabase = createAdminBrowserClient()

    if (!supabase) {
      clearAdminSession()
      setSession(null)
      router.push("/admin/login")
      return
    }

    clearAdminSession()
    supabase.auth.signOut().then(() => {
      setSession(null)
      router.push("/admin/login")
    })
  }

  if (!checked || !session) return null

  return (
    <AdminAuthContext.Provider value={{ session, signIn, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  )
}
