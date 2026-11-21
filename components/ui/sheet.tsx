"use client"

import { useEffect, useId, useRef, type ReactNode } from "react"
import { X } from "lucide-react"
import { IconButton } from "@/components/ui/icon-button"
import { cn } from "@/lib/utils"

/**
 * Modal panel on the native <dialog> element. The browser provides the focus
 * trap (inert page), Escape to close and the top layer; we add backdrop click
 * to close, focus return and scroll lock (CSS, html:has(dialog.sheet[open])).
 * Closed sheets are display:none, so nothing inside is tabbable.
 * Motion lives in globals.css (`dialog.sheet`) and honours reduced motion.
 */
export function Sheet({
  open,
  onOpenChange,
  side = "right",
  title,
  hideTitle = false,
  description,
  footer,
  className,
  bodyClassName,
  headerClassName,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  side?: "right" | "left" | "bottom" | "top" | "center"
  /** Accessible name; shown in the header unless `hideTitle`. */
  title: ReactNode
  hideTitle?: boolean
  description?: ReactNode
  /** Sticky footer, e.g. checkout or apply-filters actions. */
  footer?: ReactNode
  className?: string
  bodyClassName?: string
  /** Extra classes for the header row, e.g. to align a floating close button with centred content. */
  headerClassName?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  // Where the press started: a text selection dragged out of the panel must not close it.
  const pressStartedOnBackdrop = useRef(false)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  function handleClose() {
    // Browsers restore focus natively; this covers ones that drop it on <body>.
    const target = returnFocusRef.current
    returnFocusRef.current = null
    if (target?.isConnected && (document.activeElement === document.body || document.activeElement === null)) {
      target.focus()
    }
    if (open) onOpenChange(false)
  }

  return (
    <dialog
      ref={ref}
      data-side={side}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn("sheet", className)}
      onClose={handleClose}
      onPointerDown={event => {
        pressStartedOnBackdrop.current = event.target === event.currentTarget
      }}
      onClick={event => {
        // Only the ::backdrop reports the dialog itself as target; the panel fills the box.
        // Close only when the press both started and ended there.
        const onBackdrop = event.target === event.currentTarget && pressStartedOnBackdrop.current
        pressStartedOnBackdrop.current = false
        if (onBackdrop) event.currentTarget.close()
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            "flex items-start justify-between gap-4 px-5 py-4 md:px-6",
            hideTitle ? "absolute right-0 top-0 z-10" : "border-b border-border",
            headerClassName,
          )}
        >
          <div className={cn("min-w-0", hideTitle && "sr-only")}>
            <h2 id={titleId} className="font-serif text-2xl font-normal leading-tight text-navy-deep">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close" onClick={() => ref.current?.close()} className="-mr-2 -mt-1">
            <X />
          </IconButton>
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-6", bodyClassName)}>
          {children}
        </div>
        {footer && <div className="border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6">{footer}</div>}
      </div>
    </dialog>
  )
}
