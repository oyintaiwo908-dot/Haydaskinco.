"use client"

import { useCallback, useEffect, useState } from "react"
import { Inbox, Mail, Building2, RefreshCw } from "lucide-react"
import {
  getInboxData,
  type ContactRow,
  type NewsletterRow,
  type WholesaleRow,
} from "@/lib/supabase/inbox"
import { cn } from "@/lib/utils"
import { useAdminListParams, useAdminScrollRestore } from "@/components/admin-list-state"

type Tab = "contact" | "wholesale" | "newsletter"

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function AdminInboxPage() {
  const [query, setQuery] = useAdminListParams({ tab: "contact" })
  const tab = query.tab as Tab
  const setTab = (v: Tab) => setQuery({ tab: v })
  const [loading, setLoading] = useState(true)
  useAdminScrollRestore(!loading)
  const [newsletter, setNewsletter] = useState<NewsletterRow[]>([])
  const [contact, setContact] = useState<ContactRow[]>([])
  const [wholesale, setWholesale] = useState<WholesaleRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getInboxData()
    setNewsletter(data.newsletter)
    setContact(data.contact)
    setWholesale(data.wholesale)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const tabs: { id: Tab; label: string; count: number; icon: typeof Mail }[] = [
    { id: "contact", label: "Contact", count: contact.length, icon: Mail },
    { id: "wholesale", label: "Wholesale", count: wholesale.length, icon: Building2 },
    { id: "newsletter", label: "Newsletter", count: newsletter.length, icon: Inbox },
  ]

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-gold">Inbox</p>
          <h1 className="mt-1 font-serif text-xl font-medium sm:text-2xl">Submissions</h1>
          <p className="mt-1 text-sm font-light text-muted-foreground">
            Contact, wholesale, and newsletter signups (read-only).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex w-full items-center justify-center gap-2 border border-border px-4 py-2.5 text-xs uppercase tracking-[0.15em] hover:border-foreground sm:w-auto"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      <div className="admin-page-body">
        <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-4">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.12em] transition-colors",
                tab === t.id
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-3.5" />
              {t.label}
              <span className="tabular-nums opacity-70">({t.count})</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-48 animate-pulse bg-muted/30" />
        ) : tab === "contact" ? (
          <ContactList rows={contact} />
        ) : tab === "wholesale" ? (
          <WholesaleList rows={wholesale} />
        ) : (
          <NewsletterList rows={newsletter} />
        )}
      </div>
    </div>
  )
}

function ContactList({ rows }: { rows: ContactRow[] }) {
  if (!rows.length) {
    return <Empty label="No contact messages yet." />
  }
  return (
    <ul className="admin-table-panel space-y-3">
      {rows.map(r => (
        <li key={r.id} className="border border-border p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{r.name}</p>
            <p className="text-[11px] font-light text-muted-foreground">{formatDate(r.created_at)}</p>
          </div>
          <p className="mt-0.5 text-sm font-light text-muted-foreground">{r.email}</p>
          {r.subject && <p className="mt-2 text-sm font-medium">{r.subject}</p>}
          <p className="mt-2 whitespace-pre-wrap text-sm font-light leading-relaxed text-foreground/80">
            {r.message}
          </p>
        </li>
      ))}
    </ul>
  )
}

function WholesaleList({ rows }: { rows: WholesaleRow[] }) {
  if (!rows.length) {
    return <Empty label="No wholesale enquiries yet." />
  }
  return (
    <ul className="admin-table-panel space-y-3">
      {rows.map(r => (
        <li key={r.id} className="border border-border p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{r.business}</p>
            <p className="text-[11px] font-light text-muted-foreground">{formatDate(r.created_at)}</p>
          </div>
          <p className="mt-0.5 text-sm font-light text-muted-foreground">
            {r.name} · {r.email} · {r.phone}
          </p>
          <p className="mt-2 text-xs font-light text-muted-foreground">
            {r.type}
            {r.volume ? ` · ${r.volume}` : ""}
          </p>
          {r.message && (
            <p className="mt-2 whitespace-pre-wrap text-sm font-light leading-relaxed">{r.message}</p>
          )}
        </li>
      ))}
    </ul>
  )
}

function NewsletterList({ rows }: { rows: NewsletterRow[] }) {
  if (!rows.length) {
    return <Empty label="No newsletter subscribers yet." />
  }
  return (
    <>
      <div className="admin-table-panel admin-table-scroll hidden border border-border md:block">
      <table className="admin-data-table w-full text-left text-sm">
        <thead className="border-b border-border bg-secondary text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-light">Email</th>
            <th className="px-4 py-3 font-light">Source</th>
            <th className="px-4 py-3 font-light">Code</th>
            <th className="px-4 py-3 font-light">Joined</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-light">{r.email}</td>
              <td className="px-4 py-3 font-light text-muted-foreground">{r.source}</td>
              <td className="px-4 py-3 font-medium tracking-wider">{r.discount_code}</td>
              <td className="px-4 py-3 font-light text-muted-foreground">{formatDate(r.created_at)}</td>
            </tr>
          ))}
          <tr className="admin-table-fill" aria-hidden="true">
            <td colSpan={4} />
          </tr>
        </tbody>
      </table>
      </div>
      <ul className="admin-table-panel divide-y divide-border border border-border md:hidden">
        {rows.map(r => (
          <li key={r.id} className="p-4">
            <p className="text-sm font-medium break-all">{r.email}</p>
            <p className="mt-1 text-xs font-light text-muted-foreground">{r.source} · {formatDate(r.created_at)}</p>
            <p className="mt-2 text-xs font-medium tracking-wider text-gold">{r.discount_code}</p>
          </li>
        ))}
      </ul>
    </>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="admin-table-panel border border-dashed border-border py-16 text-center text-sm font-light text-muted-foreground">
      {label}
    </div>
  )
}
