"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Star, ThumbsUp, User, Check, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUserAuth } from "@/components/user-auth-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, Input, Select, Textarea } from "@/components/ui/field"
import { SectionHeading } from "@/components/ui/section-heading"
import {
  deleteMyReview,
  getReviewsForProduct,
  markReviewHelpful,
  submitReview,
  type ReviewRow,
} from "@/lib/supabase/reviews"

function Stars({ rating, size = "size-4" }: { rating: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn(size, rating >= i - 0.25 ? "fill-navy text-navy" : "fill-transparent text-navy/30")} />
      ))}
    </span>
  )
}

/** Keyboard-operable rating input: a radio group of five star buttons. */
function StarInput({ value, onChange }: { value: number; onChange: (r: number) => void }) {
  const [hovered, setHovered] = useState(0)
  const display = hovered || value
  return (
    <div role="radiogroup" aria-label="Your rating" className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? "s" : ""}`}
          tabIndex={value === i || (value === 0 && i === 1) ? 0 : -1}
          onMouseEnter={() => setHovered(i)}
          onClick={() => onChange(i)}
          onKeyDown={e => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(5, (value || 0) + 1)) }
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(1, (value || 2) - 1)) }
          }}
          className="flex size-11 items-center justify-center"
        >
          <Star className={cn("size-6 transition-colors", display >= i ? "fill-navy text-navy" : "fill-transparent text-navy/30")} aria-hidden />
        </button>
      ))}
    </div>
  )
}

export function ProductReviews({ productId }: { productId: string }) {
  const { session } = useUserAuth()
  const [loaded, setLoaded] = useState<{ productId: string; reviews: ReviewRow[] } | null>(null)
  const [helpfulClicked, setHelpfulClicked] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [sortBy, setSortBy] = useState<"recent" | "helpful" | "rating_high" | "rating_low">("recent")
  const [formRating, setFormRating] = useState(0)
  const [formTitle, setFormTitle] = useState("")
  const [formBody, setFormBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formError, setFormError] = useState("")
  const [formMsg, setFormMsg] = useState("")
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)

  const loading = loaded?.productId !== productId
  const reviews = useMemo(() => (loaded?.productId === productId ? loaded.reviews : []), [loaded, productId])

  const reload = useCallback(async () => {
    const data = await getReviewsForProduct(productId)
    setLoaded({ productId, reviews: data })
  }, [productId])

  useEffect(() => {
    let cancelled = false
    getReviewsForProduct(productId).then(data => {
      if (!cancelled) setLoaded({ productId, reviews: data })
    })
    return () => { cancelled = true }
  }, [productId])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    ;(async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      if (!supabase) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!cancelled) setSessionUserId(user?.id ?? null)
    })()
    return () => { cancelled = true }
  }, [session])
  const myUserId = session ? sessionUserId : null

  const ownReview = useMemo(
    () => (myUserId ? reviews.find(r => r.userId === myUserId) ?? null : null),
    [reviews, myUserId],
  )

  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  const ratingCounts = [5, 4, 3, 2, 1].map(r => ({ star: r, count: reviews.filter(rv => rv.rating === r).length }))

  const sorted = useMemo(() => {
    return [...reviews].sort((a, b) => {
      if (sortBy === "helpful") return b.helpful - a.helpful
      if (sortBy === "rating_high") return b.rating - a.rating
      if (sortBy === "rating_low") return a.rating - b.rating
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [reviews, sortBy])

  function openCreateForm() {
    setEditing(false)
    setFormRating(0)
    setFormTitle("")
    setFormBody("")
    setFormError("")
    setFormMsg("")
    setShowForm(true)
  }

  function openEditForm() {
    if (!ownReview) return
    setEditing(true)
    setFormRating(ownReview.rating)
    setFormTitle(ownReview.title)
    setFormBody(ownReview.body)
    setFormError("")
    setFormMsg("")
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(false)
    setFormError("")
  }

  async function markHelpful(id: string) {
    if (helpfulClicked.has(id) || !session) return
    const res = await markReviewHelpful(id)
    if (res.ok) {
      setLoaded(prev =>
        prev
          ? { ...prev, reviews: prev.reviews.map(r => (r.id === id ? { ...r, helpful: res.helpful ?? r.helpful + 1 } : r)) }
          : prev,
      )
      setHelpfulClicked(prev => new Set([...prev, id]))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRating || !session) return
    setSubmitting(true)
    setFormError("")
    setFormMsg("")
    // submit_review upserts when a review already exists for this user+product
    const res = await submitReview({ productId, rating: formRating, title: formTitle, body: formBody })
    setSubmitting(false)
    if (!res.ok) {
      setFormError(res.message ?? "Could not save review.")
      return
    }
    setFormMsg(editing ? "Your review has been updated." : "Your review has been submitted.")
    setShowForm(false)
    setEditing(false)
    await reload()
  }

  async function handleDelete() {
    if (!ownReview) return
    if (!window.confirm("Delete your review for this product?")) return
    setDeleting(true)
    const err = await deleteMyReview(ownReview.id)
    setDeleting(false)
    if (err) {
      setFormError(err)
      return
    }
    setFormMsg("Your review was deleted.")
    setShowForm(false)
    setEditing(false)
    await reload()
  }

  return (
    <section id="reviews" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-[clamp(3rem,2rem+4vw,6rem)] lg:px-8" aria-labelledby="reviews-title">
      <SectionHeading eyebrow="What customers say" title={<span id="reviews-title">Reviews</span>} className="mb-8" />
      <div className="mb-10 grid gap-8 md:grid-cols-[auto_1fr_auto] md:items-start md:gap-12">
        <div>
          <p className="font-serif text-6xl leading-none text-navy-deep tabular-nums">{loading ? "—" : avgRating.toFixed(1)}</p>
          <span className="mt-2 block"><Stars rating={avgRating} size="size-5" /></span>
          <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
            {loading ? "Loading reviews…" : `${reviews.length} review${reviews.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <ul className="space-y-2" aria-label="Rating breakdown">
          {ratingCounts.map(({ star, count }) => (
            <li key={star} className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="w-12 shrink-0">{star} star</span>
              <span className="h-1.5 flex-1 overflow-hidden bg-secondary" aria-hidden>
                <span
                  className="block h-full bg-navy transition-[width] duration-500 ease-atelier"
                  style={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : "0%" }}
                />
              </span>
              <span className="w-6 text-right tabular-nums">{count}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          {formMsg && (
            <p role="status" className="flex items-center gap-2 text-sm text-success">
              <Check aria-hidden className="size-4" /> {formMsg}
            </p>
          )}
          {ownReview ? (
            <>
              <Button variant="outline" onClick={() => (showForm && editing ? closeForm() : openEditForm())} aria-expanded={showForm}>
                <Pencil aria-hidden /> {showForm && editing ? "Cancel" : "Edit your review"}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                <Trash2 aria-hidden /> {deleting ? "Deleting…" : "Delete review"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => (showForm ? closeForm() : openCreateForm())} aria-expanded={showForm}>
              {showForm ? "Cancel" : "Write a review"}
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="mb-10 border border-border p-5 md:p-8">
          <h3 className="mb-5 font-serif text-2xl text-navy-deep">{editing ? "Update your review" : "Share your experience"}</h3>

          {!session ? (
            <div className="flex flex-col items-start gap-4 bg-secondary p-5">
              <div>
                <p className="mb-1 font-medium">Sign in to leave a review</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  You can write one review per product. Signed-in reviews can earn rewards points and are marked
                  <span className="font-medium text-foreground"> Verified Purchase</span> if you bought this product.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/login" className={buttonVariants()}>Sign in</Link>
                <Link href="/register" className={buttonVariants({ variant: "outline" })}>Create account</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <User aria-hidden className="size-4" />
                Reviewing as {session.email}
                {editing && <span className="text-navy">· editing your existing review</span>}
              </p>
              <fieldset>
                <legend className="mb-1 text-xs font-medium uppercase tracking-[0.14em]">
                  Your rating <span aria-hidden className="text-rose">*</span>
                </legend>
                <StarInput value={formRating} onChange={setFormRating} />
              </fieldset>
              <Field label="Review title" required>
                <Input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Sum up your experience in a few words"
                />
              </Field>
              <Field label="Your review" required error={formError || undefined}>
                <Textarea
                  value={formBody}
                  onChange={e => setFormBody(e.target.value)}
                  placeholder="Tell others about your experience with this product…"
                  rows={4}
                  className="resize-none"
                />
              </Field>
              <Button type="submit" disabled={!formRating || !formBody || submitting}>
                {submitting ? "Saving…" : editing ? "Update review" : "Submit review"}
              </Button>
            </form>
          )}
        </div>
      )}

      {reviews.length > 0 && (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <p className="text-sm text-muted-foreground">
              {reviews.length} review{reviews.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="review-sort" className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Sort</label>
              <div className="w-44">
                <Select id="review-sort" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="h-10 text-sm">
                  <option value="recent">Most recent</option>
                  <option value="helpful">Most helpful</option>
                  <option value="rating_high">Highest rated</option>
                  <option value="rating_low">Lowest rated</option>
                </Select>
              </div>
            </div>
          </div>

          <ul className="divide-y divide-border">
            {sorted.map(review => {
              const isMine = Boolean(myUserId && review.userId === myUserId)
              return (
                <li key={review.id} className="flex items-start gap-4 py-7">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium text-navy">
                    {review.authorInitial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="font-medium">{review.author}</p>
                      {isMine && (
                        <span className="bg-secondary px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-navy">Your review</span>
                      )}
                      {review.verified && (
                        <span className="flex items-center gap-1 text-xs font-medium text-success">
                          <Check aria-hidden className="size-3.5" /> Verified purchase
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.date).toLocaleDateString("en-GB", { month: "long", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    <span className="mt-1 block">
                      <Stars rating={review.rating} size="size-3.5" />
                      <span className="sr-only">Rated {review.rating} out of 5</span>
                    </span>
                    {review.title && <p className="mt-3 font-medium">{review.title}</p>}
                    <p className="mt-1 leading-relaxed text-muted-foreground">{review.body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => markHelpful(review.id)}
                        disabled={helpfulClicked.has(review.id) || !session || isMine}
                        title={!session ? "Sign in to mark helpful" : isMine ? "You can't mark your own review" : undefined}
                        className={cn(
                          "inline-flex min-h-11 items-center gap-1.5 pr-3 text-sm transition-colors",
                          helpfulClicked.has(review.id) ? "text-navy" : "text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground",
                        )}
                      >
                        <ThumbsUp aria-hidden className="size-4" /> Helpful ({review.helpful})
                      </button>
                      {isMine && (
                        <>
                          <button type="button" onClick={openEditForm} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground">
                            <Pencil aria-hidden className="size-3.5" /> Edit
                          </button>
                          <button type="button" onClick={handleDelete} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm text-muted-foreground hover:text-destructive">
                            <Trash2 aria-hidden className="size-3.5" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {!loading && reviews.length === 0 && !showForm && (
        <p className="border-t border-border py-8 text-muted-foreground">No reviews yet. Be the first to share your experience.</p>
      )}
    </section>
  )
}
