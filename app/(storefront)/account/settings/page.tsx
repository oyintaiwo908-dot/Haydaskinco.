"use client"

import { useState, useEffect, useCallback } from "react"
import { Check, Eye, EyeOff, Plus, Trash2, MapPin, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getProfile, updateProfile, updatePassword, updatePreferences,
  getAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress, claimProfileBonus,
  DEFAULT_PREFS,
  type Profile, type Address, type NotificationPrefs,
} from "@/lib/supabase/profile"

type Section = "profile" | "password" | "addresses" | "preferences"

const EMPTY_ADDR: Omit<Address, "id" | "is_default"> = {
  label: "Home",
  full_name: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "Nigeria",
  phone: "",
}

export default function AccountSettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>("profile")
  const [profileData, setProfileData] = useState<Profile | null>(null)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)

  // Profile form state
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Password form state
  const [passwords, setPasswords] = useState({ next: "", confirm: "" })
  const [showNext, setShowNext] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Address form state
  const [addingAddress, setAddingAddress] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newAddr, setNewAddr] = useState<Omit<Address, "id" | "is_default">>({ ...EMPTY_ADDR })
  const [addrSaving, setAddrSaving] = useState(false)
  const [defaultSavingId, setDefaultSavingId] = useState<string | null>(null)

  const [prefs, setPrefs] = useState<NotificationPrefs>({ ...DEFAULT_PREFS })
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsMsg, setPrefsMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [profile, addrs] = await Promise.all([getProfile(), getAddresses()])
    setProfileData(profile)
    setFullName(profile?.full_name ?? "")
    setPhone(profile?.phone ?? "")
    if (profile?.preferences) setPrefs(profile.preferences)
    setAddresses(addrs)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleProfileSave() {
    setProfileSaving(true)
    setProfileMsg(null)
    const err = await updateProfile({ full_name: fullName, phone })
    if (err) {
      setProfileMsg({ ok: false, text: err })
      setProfileSaving(false)
      setTimeout(() => setProfileMsg(null), 3000)
      return
    }

    let text = "Profile saved."
    if (fullName.trim() && phone.trim()) {
      const bonus = await claimProfileBonus()
      if (bonus?.claimed && bonus.points) {
        text = `Profile saved. You earned ${bonus.points} loyalty points!`
      }
    }
    setProfileMsg({ ok: true, text })
    setProfileSaving(false)
    setTimeout(() => setProfileMsg(null), 4000)
  }

  async function handlePasswordSave() {
    if (passwords.next !== passwords.confirm) {
      setPwMsg({ ok: false, text: "Passwords do not match." })
      return
    }
    if (passwords.next.length < 8) {
      setPwMsg({ ok: false, text: "Password must be at least 8 characters." })
      return
    }
    setPwSaving(true)
    setPwMsg(null)
    const err = await updatePassword(passwords.next)
    setPwMsg(err ? { ok: false, text: err } : { ok: true, text: "Password updated successfully." })
    setPwSaving(false)
    if (!err) setPasswords({ next: "", confirm: "" })
    setTimeout(() => setPwMsg(null), 3000)
  }

  function resetAddressForm() {
    setAddingAddress(false)
    setEditingId(null)
    setNewAddr({ ...EMPTY_ADDR, full_name: fullName })
  }

  function startEditAddress(addr: Address) {
    setAddingAddress(false)
    setEditingId(addr.id)
    setNewAddr({
      label: addr.label,
      full_name: addr.full_name,
      line1: addr.line1,
      line2: addr.line2 ?? "",
      city: addr.city,
      state: addr.state,
      postal_code: addr.postal_code ?? "",
      country: addr.country,
      phone: addr.phone ?? "",
    })
  }

  async function handleSaveAddress() {
    if (!newAddr.line1 || !newAddr.city) return
    setAddrSaving(true)
    const err = editingId
      ? await updateAddress(editingId, newAddr)
      : await addAddress({ ...newAddr, is_default: addresses.length === 0 })
    if (!err) {
      await load()
      resetAddressForm()
    }
    setAddrSaving(false)
  }

  async function handleDeleteAddress(id: string) {
    if (editingId === id) resetAddressForm()
    await deleteAddress(id)
    await load()
  }

  async function handleSetDefault(id: string) {
    setDefaultSavingId(id)
    const err = await setDefaultAddress(id)
    if (!err) await load()
    setDefaultSavingId(null)
  }

  const SECTIONS: { id: Section; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "password", label: "Password" },
    { id: "addresses", label: "Addresses" },
    { id: "preferences", label: "Preferences" },
  ]

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted/50 animate-pulse" />
        <div className="h-4 w-64 bg-muted/30 animate-pulse" />
        <div className="h-24 w-full bg-muted/20 animate-pulse mt-6" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-medium">Account Settings</h2>
        <p className="mt-1 text-sm font-light text-muted-foreground">Manage your profile, security, and preferences.</p>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 border-b border-border pb-px overflow-x-auto">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveSection(s.id)}
            className={cn(
              "shrink-0 pb-3 px-1 text-xs font-light uppercase tracking-[0.15em] transition-colors border-b-2 -mb-px",
              activeSection === s.id
                ? "border-foreground text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {activeSection === "profile" && (
        <section className="space-y-5">
          <Field label="Full Name">
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your full name"
              className="input-field"
            />
          </Field>
          <Field label="Email Address">
            <div className="relative">
              <input
                type="email"
                value={profileData?.email ?? ""}
                disabled
                className="input-field opacity-60 cursor-not-allowed pr-32"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-light uppercase tracking-[0.12em] text-muted-foreground">
                Managed by Auth
              </span>
            </div>
          </Field>
          <Field label="Phone Number">
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+234 800 000 0000"
              className="input-field"
            />
          </Field>
          {profileMsg && (
            <p className={cn("text-xs px-4 py-2.5 border", profileMsg.ok
              ? "text-green-700 bg-green-50 border-green-200"
              : "text-destructive bg-destructive/10 border-destructive/20"
            )}>
              {profileMsg.text}
            </p>
          )}
          <SaveButton onClick={handleProfileSave} loading={profileSaving} />
        </section>
      )}

      {/* Password */}
      {activeSection === "password" && (
        <section className="space-y-5">
          <p className="text-sm font-light text-muted-foreground">
            Enter a new password below. You will remain signed in on this device.
          </p>
          <PasswordField
            label="New Password"
            value={passwords.next}
            show={showNext}
            onShow={() => setShowNext(v => !v)}
            onChange={e => setPasswords(p => ({ ...p, next: e.target.value }))}
          />
          <Field label="Confirm New Password">
            <input
              type="password"
              value={passwords.confirm}
              onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
              placeholder="••••••••"
              className={cn(
                "input-field",
                passwords.confirm && passwords.confirm !== passwords.next
                  ? "border-destructive focus:border-destructive" : "",
              )}
            />
          </Field>
          {pwMsg && (
            <p className={cn("text-xs px-4 py-2.5 border", pwMsg.ok
              ? "text-green-700 bg-green-50 border-green-200"
              : "text-destructive bg-destructive/10 border-destructive/20"
            )}>
              {pwMsg.text}
            </p>
          )}
          <SaveButton onClick={handlePasswordSave} loading={pwSaving} label="Update Password" />
        </section>
      )}

      {/* Addresses */}
      {activeSection === "addresses" && (
        <section className="space-y-4">
          {addresses.length === 0 && !addingAddress && !editingId && (
            <p className="text-sm font-light text-muted-foreground">No saved addresses yet.</p>
          )}
          {addresses.map(addr => (
            editingId === addr.id ? (
            <div key={addr.id} className="border border-border p-5 space-y-4">
              <h3 className="text-xs font-medium uppercase tracking-[0.18em]">Edit Address</h3>
              <AddressFields addr={newAddr} onChange={setNewAddr} />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveAddress}
                  disabled={addrSaving || !newAddr.line1 || !newAddr.city}
                  className="bg-foreground px-5 py-2.5 text-xs font-medium uppercase tracking-[0.15em] text-background hover:bg-gold hover:text-gold-foreground transition-colors disabled:opacity-50"
                >
                  {addrSaving ? "Saving…" : "Update Address"}
                </button>
                <button type="button" onClick={resetAddressForm} className="border border-border px-5 py-2.5 text-xs font-light uppercase tracking-[0.15em] hover:border-foreground transition-colors">
                  Cancel
                </button>
              </div>
            </div>
            ) : (
            <div key={addr.id} className={cn("border p-5", addr.is_default ? "border-gold/40 bg-lavender" : "border-border")}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-[0.15em]">{addr.label}</span>
                  {addr.is_default && (
                    <span className="border border-gold/40 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-widest text-gold bg-lavender">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEditAddress(addr)}
                    disabled={!!editingId || addingAddress}
                    className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                    aria-label="Edit address"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAddress(addr.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Delete address"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="text-sm font-light text-muted-foreground leading-relaxed pl-6">
                <p className="font-medium text-foreground">{addr.full_name}</p>
                <p>{addr.line1}</p>
                {addr.line2 && <p>{addr.line2}</p>}
                <p>
                  {addr.city}, {addr.state}
                  {addr.postal_code ? ` ${addr.postal_code}` : ""}
                </p>
                <p>{addr.country}</p>
                {addr.phone && <p>{addr.phone}</p>}
              </div>
              {!addr.is_default && (
                <div className="mt-4 pl-6">
                  <button
                    type="button"
                    onClick={() => handleSetDefault(addr.id)}
                    disabled={defaultSavingId === addr.id}
                    className="border border-border px-3 py-1.5 text-[11px] font-light uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
                  >
                    {defaultSavingId === addr.id ? "Saving…" : "Set as default"}
                  </button>
                </div>
              )}
            </div>
            )
          ))}

          {addingAddress ? (
            <div className="border border-border p-5 space-y-4">
              <h3 className="text-xs font-medium uppercase tracking-[0.18em]">New Address</h3>
              <AddressFields addr={newAddr} onChange={setNewAddr} />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveAddress}
                  disabled={addrSaving || !newAddr.line1 || !newAddr.city}
                  className="bg-foreground px-5 py-2.5 text-xs font-medium uppercase tracking-[0.15em] text-background hover:bg-gold hover:text-gold-foreground transition-colors disabled:opacity-50"
                >
                  {addrSaving ? "Saving…" : "Save Address"}
                </button>
                <button type="button" onClick={resetAddressForm} className="border border-border px-5 py-2.5 text-xs font-light uppercase tracking-[0.15em] hover:border-foreground transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : !editingId ? (
            <button
              type="button"
              onClick={() => { setEditingId(null); setNewAddr({ ...EMPTY_ADDR, full_name: fullName }); setAddingAddress(true) }}
              className="flex w-full items-center justify-center gap-2 border border-dashed border-border py-4 text-xs font-light uppercase tracking-[0.15em] text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
            >
              <Plus className="size-3.5" /> Add New Address
            </button>
          ) : null}
        </section>
      )}

      {/* Preferences */}
      {activeSection === "preferences" && (
        <section className="space-y-6">
          <div>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.18em]">Email Notifications</h3>
            <div className="space-y-3">
              {([
                { key: "newsletter",   label: "Newsletter & editorial",  desc: "Skincare tips, guides, and HAYDA SKINCo. news" },
                { key: "orderUpdates", label: "Order updates",           desc: "Shipping confirmations and delivery status" },
                { key: "newProducts",  label: "New product launches",    desc: "Be first to know about new arrivals" },
                { key: "saleAlerts",   label: "Promotions & offers",     desc: "Exclusive offers for HAYDA SKINCo. members" },
              ] as const).map(({ key, label, desc }) => (
                <label key={key} className="flex cursor-pointer items-start justify-between gap-4 border border-border p-4 hover:bg-secondary transition-colors">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs font-light text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  <div
                    onClick={() => setPrefs(p => ({ ...p, [key]: !p[key] }))}
                    className={cn(
                      "relative mt-0.5 h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-all",
                      prefs[key] ? "border-gold bg-gold" : "border-border bg-background",
                    )}
                  >
                    <span className={cn("absolute top-0.5 size-3 rounded-full bg-background transition-all", prefs[key] ? "left-3.5 bg-gold-foreground" : "left-0.5")} />
                  </div>
                </label>
              ))}
            </div>
          </div>
          {prefsMsg && (
            <p className={cn("text-xs px-4 py-2.5 border", prefsMsg.ok
              ? "text-green-700 bg-green-50 border-green-200"
              : "text-destructive bg-destructive/10 border-destructive/20"
            )}>
              {prefsMsg.text}
            </p>
          )}
          <SaveButton
            onClick={async () => {
              setPrefsSaving(true)
              setPrefsMsg(null)
              const err = await updatePreferences(prefs)
              setPrefsMsg(err ? { ok: false, text: err } : { ok: true, text: "Preferences saved." })
              setPrefsSaving(false)
              setTimeout(() => setPrefsMsg(null), 3000)
            }}
            loading={prefsSaving}
            label="Save Preferences"
          />
        </section>
      )}

      <style jsx global>{`
        .input-field {
          width: 100%;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 0.625rem 1rem;
          font-size: 0.875rem;
          font-weight: 300;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-field:focus { border-color: hsl(var(--foreground)); }
      `}</style>
    </div>
  )
}

function AddressFields({
  addr,
  onChange,
}: {
  addr: Omit<Address, "id" | "is_default">
  onChange: React.Dispatch<React.SetStateAction<Omit<Address, "id" | "is_default">>>
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Label">
          <input type="text" value={addr.label} onChange={e => onChange(a => ({ ...a, label: e.target.value }))} placeholder="Home / Work" className="input-field" />
        </Field>
        <Field label="Full Name">
          <input type="text" value={addr.full_name} onChange={e => onChange(a => ({ ...a, full_name: e.target.value }))} className="input-field" />
        </Field>
      </div>
      <Field label="Address Line 1">
        <input type="text" value={addr.line1} onChange={e => onChange(a => ({ ...a, line1: e.target.value }))} className="input-field" />
      </Field>
      <Field label="Apartment, suite, etc. (optional)">
        <input
          type="text"
          value={addr.line2 ?? ""}
          onChange={e => onChange(a => ({ ...a, line2: e.target.value }))}
          placeholder="Apt, floor, suite…"
          className="input-field"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City"><input type="text" value={addr.city} onChange={e => onChange(a => ({ ...a, city: e.target.value }))} className="input-field" /></Field>
        <Field label="State"><input type="text" value={addr.state} onChange={e => onChange(a => ({ ...a, state: e.target.value }))} className="input-field" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ZIP / Postal Code">
          <input
            type="text"
            value={addr.postal_code ?? ""}
            onChange={e => onChange(a => ({ ...a, postal_code: e.target.value }))}
            className="input-field"
          />
        </Field>
        <Field label="Country"><input type="text" value={addr.country} onChange={e => onChange(a => ({ ...a, country: e.target.value }))} className="input-field" /></Field>
      </div>
      <Field label="Phone (optional)">
        <input type="tel" value={addr.phone ?? ""} onChange={e => onChange(a => ({ ...a, phone: e.target.value }))} className="input-field" />
      </Field>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-light uppercase tracking-[0.15em] text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function PasswordField({ label, value, show, onShow, onChange }: {
  label: string; value: string; show: boolean
  onShow: () => void; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder="••••••••" className="input-field pr-11" />
        <button type="button" onClick={onShow} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </Field>
  )
}

function SaveButton({ onClick, loading, label = "Save Changes" }: { onClick: () => void | Promise<void>; loading: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex items-center gap-2 px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] transition-all",
        loading
          ? "bg-muted text-muted-foreground cursor-not-allowed"
          : "bg-foreground text-background hover:bg-gold hover:text-gold-foreground",
      )}
    >
      {loading ? (
        <span className="size-3.5 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
      ) : (
        <><Check className="size-3.5" /> {label}</>
      )}
    </button>
  )
}
