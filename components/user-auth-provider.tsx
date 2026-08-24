"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  type UserSession,
  getUserSession,
  saveUserSession,
  clearUserSession,
  extractFirstName,
  supabaseUserToUserSession,
} from "@/lib/auth"

/* ─── Context ────────────────────────────────────────────────── */
type UserAuthCtx = {
  session: UserSession | null
  /** Returns error string on failure, null on success */
  signIn: (email: string, password: string) => Promise<string | null>
  /** Returns error string on failure, null on success */
  signUp: (name: string, email: string, password: string) => Promise<string | null>
  signOut: () => void
}

const UserAuthContext = createContext<UserAuthCtx>({
  session: null,
  signIn: async () => "Not initialised",
  signUp: async () => "Not initialised",
  signOut: () => {},
})

export function useUserAuth() {
  return useContext(UserAuthContext)
}

/* ─── Provider ───────────────────────────────────────────────── */
export function UserAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    if (!supabase) {
      // Dev-only mock mode (no Supabase env vars)
      setSession(getUserSession())
      setMounted(true)
      return
    }

    // Supabase is live — never trust leftover mock localStorage sessions
    clearUserSession()

    async function buildSession(user: import("@supabase/supabase-js").User) {
      const base = supabaseUserToUserSession(user)
      const { data: profile } = await supabase!
        .from("profiles")
        .select("full_name, first_name, phone, is_suspended")
        .eq("id", user.id)
        .single()
      if (profile?.is_suspended) {
        await supabase!.auth.signOut()
        return null
      }
      if (!profile) return base
      const firstName = profile.first_name ?? extractFirstName(profile.full_name ?? user.email ?? "")
      return {
        ...base,
        name: profile.full_name ?? base.name,
        firstName,
      }
    }

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (s?.user) {
        setSession(await buildSession(s.user))
      }
      setMounted(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (s?.user) {
        setSession(await buildSession(s.user))
      } else {
        setSession(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  /* ── signIn ── */
  async function signIn(email: string, password: string): Promise<string | null> {
    const supabase = createClient()

    if (!supabase) {
      // Mock path
      await new Promise(r => setTimeout(r, 800))
      if (!email || !password) return "Please enter your email and password."
      const firstName = extractFirstName(email)
      const s: UserSession = { email, name: firstName, firstName, signedInAt: Date.now() }
      saveUserSession(s)
      setSession(s)
      return null
    }

    clearUserSession()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if ((error as { code?: string }).code === "email_not_confirmed") {
        return "email_not_confirmed"
      }
      return error.message
    }
    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_suspended")
        .eq("id", data.user.id)
        .maybeSingle()
      if (profile?.is_suspended) {
        await supabase.auth.signOut()
        return "This account has been suspended."
      }
    }
    // Attach guest checkouts that used this email
    void supabase.rpc("claim_guest_orders")
    return null
  }

  /* ── signUp ── */
  async function signUp(name: string, email: string, password: string): Promise<string | null> {
    const supabase = createClient()

    if (!supabase) {
      // Mock path
      await new Promise(r => setTimeout(r, 800))
      if (!name || !email || !password) return "Please fill in all fields."
      const firstName = extractFirstName(name)
      const s: UserSession = { email, name, firstName, signedInAt: Date.now() }
      saveUserSession(s)
      setSession(s)
      void fetch("/api/email/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      })
      return null
    }

    const firstName = extractFirstName(name)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, first_name: firstName },
      },
    })
    if (error) return error.message
    // Welcome only when a session exists (email confirmation may leave session null)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      void fetch("/api/email/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, name }),
      })
    }
    return null
  }

  /* ── signOut ── */
  function signOut() {
    const supabase = createClient()

    if (!supabase) {
      clearUserSession()
      setSession(null)
      return
    }

    clearUserSession()
    supabase.auth.signOut().then(() => setSession(null))
  }

  return (
    <UserAuthContext.Provider value={{ session: mounted ? session : null, signIn, signUp, signOut }}>
      {children}
    </UserAuthContext.Provider>
  )
}
