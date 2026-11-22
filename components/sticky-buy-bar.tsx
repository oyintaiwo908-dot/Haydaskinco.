"use client"

import { useEffect, useState, type RefObject } from "react"
import Image from "next/image"
import { Check } from "lucide-react"
import { Price } from "@/components/ui/price"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * The buy panel, condensed. Once the main add-to-cart row has scrolled above the viewport it
 * reappears as a slim bar: at the bottom on phones, sliding down under the header on desktop
 * (thumbnail, name, price, button). Transform and opacity only. `data-buy-bar="visible"`
 * lifts the WhatsApp button clear on phones.
 */
export function StickyBuyBar({
  watchRef,
  name,
  brand,
  image,
  amount,
  compareAt,
  disabled,
  added,
  onAdd,
}: {
  watchRef: RefObject<HTMLElement | null>
  name: string
  brand?: string
  image?: string
  amount: number
  compareAt?: number | null
  disabled?: boolean
  added?: boolean
  onAdd: () => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = watchRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [watchRef])

  return (
    <div
      data-buy-bar={visible ? "visible" : "hidden"}
      inert={!visible}
      className={cn(
        "buy-bar fixed inset-x-0 z-30 border-navy/10 bg-background/90 backdrop-blur-xl backdrop-saturate-150",
        "bottom-0 border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3",
        "lg:bottom-auto lg:top-16 lg:border-b lg:border-t-0 lg:px-8 lg:py-2.5 lg:shadow-[0_18px_40px_-30px_rgb(31_37_56/0.5)]",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div className="mx-auto flex max-w-xl items-center gap-3 lg:max-w-7xl lg:gap-5">
        {image && (
          <span className="product-stage relative hidden size-12 shrink-0 overflow-hidden lg:block">
            <Image src={image} alt="" fill sizes="48px" className="object-cover" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {brand && <p className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-rose lg:block">{brand}</p>}
          <p className="truncate text-xs text-muted-foreground lg:font-serif lg:text-lg lg:text-navy-deep">{name}</p>
          <Price amount={amount} compareAt={compareAt} size="sm" className="lg:hidden" />
        </div>
        <Price amount={amount} compareAt={compareAt} size="sm" className="hidden font-serif text-xl lg:flex" />
        <Button onClick={onAdd} disabled={disabled} className="min-w-36 btn-sheen">
          {disabled ? "Out of stock" : added ? <><Check aria-hidden /> Added</> : "Add to cart"}
        </Button>
      </div>
    </div>
  )
}
