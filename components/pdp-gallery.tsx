"use client"

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react"
import Image from "next/image"
import { ZoomIn } from "lucide-react"
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion"
import { ViewTransition } from "@/components/motion/view-transition"
import { cn } from "@/lib/utils"

const ZOOM = 2.2

/**
 * Product gallery. One scroll-snap track: native swipe (with the platform's momentum) on touch,
 * drag with momentum for a mouse, thumbnails, and arrow keys on the focused track. Zoom: on a
 * fine pointer the photo magnifies under the cursor; on touch, double-tap zooms at that point
 * and a drag pans until the next double-tap. Zoom moves the image by transform only. Frames
 * are a fixed 4:5, so nothing shifts when photos load. `morphName` ties the first photo to the
 * product card it was opened from (React <ViewTransition>).
 */
export function PdpGallery({
  images,
  productName,
  overlay,
  morphName,
}: {
  images: string[]
  productName: string
  /** Badges drawn over the stage. */
  overlay?: ReactNode
  morphName?: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const many = images.length > 1
  const drag = useRef<{ x: number; left: number; t: number; v: number; moved: boolean } | null>(null)
  const momentum = useRef(0)
  const lastTap = useRef(0)
  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const offset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const track = trackRef.current
    if (!track || !many) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setActive(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)))
      })
    }
    track.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      track.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
      cancelAnimationFrame(momentum.current)
    }
  }, [many])

  function goTo(index: number) {
    const track = trackRef.current
    if (!track) return
    resetZoom()
    const next = Math.max(0, Math.min(images.length - 1, index))
    track.scrollTo({ left: next * track.clientWidth, behavior: reducedMotion ? "auto" : "smooth" })
  }

  function zoomLayer(index = active) {
    return trackRef.current?.querySelectorAll<HTMLElement>("[data-zoom]")[index] ?? null
  }

  function applyZoom(el: HTMLElement, x: number, y: number) {
    el.style.transform = `translate(${x}px, ${y}px) scale(${ZOOM})`
  }

  function resetZoom() {
    const el = zoomLayer()
    if (el) el.style.transform = ""
    offset.current = { x: 0, y: 0 }
    setZoomed(false)
  }

  /** Offset that keeps the point under (px, py) fixed when scaling about the centre. */
  function focusOffset(el: HTMLElement, clientX: number, clientY: number) {
    const r = el.parentElement!.getBoundingClientRect()
    const cx = clientX - r.left - r.width / 2
    const cy = clientY - r.top - r.height / 2
    const maxX = (r.width * (ZOOM - 1)) / 2
    const maxY = (r.height * (ZOOM - 1)) / 2
    return {
      x: Math.max(-maxX, Math.min(maxX, -cx * (ZOOM - 1))),
      y: Math.max(-maxY, Math.min(maxY, -cy * (ZOOM - 1))),
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (d) {
      const dx = e.clientX - d.x
      if (!d.moved && Math.abs(dx) < 6) return
      if (!d.moved) {
        d.moved = true
        resetZoom()
        e.currentTarget.setPointerCapture(e.pointerId)
        e.currentTarget.dataset.dragging = ""
      }
      const now = e.timeStamp
      const next = d.left - dx
      d.v = (e.currentTarget.scrollLeft - next) / Math.max(1, now - d.t)
      d.t = now
      e.currentTarget.scrollLeft = next
      return
    }
    const el = zoomLayer()
    if (!el || reducedMotion) return
    if (e.pointerType === "mouse") {
      const o = focusOffset(el, e.clientX, e.clientY)
      applyZoom(el, o.x, o.y)
      if (!zoomed) setZoomed(true)
    } else if (zoomed && pan.current) {
      const p = pan.current
      const r = el.parentElement!.getBoundingClientRect()
      const maxX = (r.width * (ZOOM - 1)) / 2
      const maxY = (r.height * (ZOOM - 1)) / 2
      offset.current = {
        x: Math.max(-maxX, Math.min(maxX, p.ox + (e.clientX - p.x))),
        y: Math.max(-maxY, Math.min(maxY, p.oy + (e.clientY - p.y))),
      }
      applyZoom(el, offset.current.x, offset.current.y)
    }
  }

  return (
    <div className="flex min-w-0 gap-4">
      {many && (
        <ul className="hidden w-[72px] shrink-0 flex-col gap-3 sm:flex" aria-label="Product images">
          {images.map((src, i) => (
            <li key={`${src}-${i}`}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === active ? "true" : undefined}
                className={cn(
                  "product-stage relative block aspect-4/5 w-full overflow-hidden transition-[box-shadow,opacity] duration-300",
                  i === active ? "ring-1 ring-navy" : "opacity-70 ring-1 ring-transparent hover:opacity-100 hover:ring-navy/40",
                )}
              >
                <Image src={src} alt="" fill sizes="72px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative min-w-0 flex-1">
        <ViewTransition name={morphName} share="product-morph" default="none">
          <div
            ref={trackRef}
            tabIndex={many ? 0 : -1}
            role={many ? "region" : undefined}
            aria-roledescription={many ? "carousel" : undefined}
            aria-label={many ? `${productName} images` : undefined}
            onKeyDown={e => {
              if (e.key === "ArrowRight") { e.preventDefault(); goTo(active + 1) }
              if (e.key === "ArrowLeft") { e.preventDefault(); goTo(active - 1) }
              if (e.key === "Escape") resetZoom()
            }}
            onPointerDown={e => {
              cancelAnimationFrame(momentum.current)
              if (e.pointerType === "mouse") {
                if (many && e.button === 0) drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, t: e.timeStamp, v: 0, moved: false }
                return
              }
              // Touch: double-tap toggles zoom at the tap; while zoomed a drag pans.
              const now = e.timeStamp
              const el = zoomLayer()
              if (el && !reducedMotion && now - lastTap.current < 300) {
                lastTap.current = 0
                if (zoomed) {
                  resetZoom()
                } else {
                  const o = focusOffset(el, e.clientX, e.clientY)
                  offset.current = o
                  applyZoom(el, o.x, o.y)
                  setZoomed(true)
                }
                return
              }
              lastTap.current = now
              if (zoomed) pan.current = { x: e.clientX, y: e.clientY, ox: offset.current.x, oy: offset.current.y }
            }}
            onPointerMove={onPointerMove}
            onPointerUp={e => {
              pan.current = null
              const d = drag.current
              drag.current = null
              if (!d?.moved) return
              const el = e.currentTarget
              let v = reducedMotion ? 0 : -d.v * 16
              const step = () => {
                if (Math.abs(v) < 0.5) {
                  delete el.dataset.dragging
                  return
                }
                el.scrollLeft += v
                v *= 0.9
                momentum.current = requestAnimationFrame(step)
              }
              step()
            }}
            onPointerLeave={e => {
              if (e.pointerType === "mouse" && !drag.current) resetZoom()
            }}
            className={cn(
              "gallery-track product-stage no-scrollbar flex aspect-4/5 snap-x snap-mandatory overflow-x-auto overscroll-x-contain",
              zoomed ? "touch-none" : "touch-pan-x touch-pan-y",
              "[@media(hover:hover)_and_(pointer:fine)]:cursor-zoom-in",
            )}
          >
            {images.map((src, i) => (
              <div key={`${src}-${i}`} className="relative h-full w-full shrink-0 snap-start overflow-hidden" aria-hidden={i !== active || undefined}>
                <div data-zoom="" className="gallery-zoom absolute inset-0">
                  <Image
                    src={src}
                    alt={i === 0 ? productName : `${productName}, view ${i + 1}`}
                    fill
                    priority={i === 0}
                    loading={i === 0 ? "eager" : "lazy"}
                    sizes="(max-width: 1024px) 100vw, 55vw"
                    className="object-cover"
                    draggable={false}
                  />
                </div>
              </div>
            ))}
          </div>
        </ViewTransition>
        {overlay}
        <p
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-3 left-3 hidden items-center gap-1.5 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-navy-deep transition-opacity duration-300 [@media(hover:hover)_and_(pointer:fine)]:flex",
            zoomed && "opacity-0",
          )}
        >
          <ZoomIn className="size-3.5" /> Hover to zoom
        </p>
        {many && (
          <>
            <p className="absolute bottom-3 right-3 rounded-control bg-white/90 px-2 py-1 text-xs font-medium tabular-nums text-navy-deep sm:hidden" aria-hidden>
              {active + 1} / {images.length}
            </p>
            <div className="absolute inset-x-0 bottom-1 flex justify-center sm:hidden">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Show image ${i + 1} of ${images.length}`}
                  aria-current={i === active ? "true" : undefined}
                  className="flex h-8 w-6 items-center justify-center"
                >
                  <span className={cn("block h-1 rounded-full bg-navy transition-[scale,opacity] duration-300", i === active ? "w-4 opacity-100" : "w-4 scale-x-[0.4] opacity-30")} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
