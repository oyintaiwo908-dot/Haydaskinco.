"use client"

import Image from "next/image"
import { ShoppingBag } from "lucide-react"
import { cn } from "@/lib/utils"

export function isDealLineItem(productId: string): boolean {
  return productId.startsWith("deal__")
}

const SIZE_CLASS = {
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
  xl: "size-16",
} as const

const ICON_CLASS = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-6",
  xl: "size-7",
} as const

/** Product thumbnail for order lines — deals / missing images use a bag icon. */
export function OrderItemThumb({
  productId,
  image,
  name,
  size = "md",
  className,
  sizes,
}: {
  productId: string
  image?: string | null
  name: string
  size?: keyof typeof SIZE_CLASS
  className?: string
  sizes?: string
}) {
  const box = SIZE_CLASS[size]
  const icon = ICON_CLASS[size]
  const showIcon = !image || image === "/product-bundle.png"

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden",
        box,
        showIcon
          ? "flex items-center justify-center border border-gold/30 bg-lavender"
          : "product-stage",
        className,
      )}
    >
      {showIcon ? (
        <ShoppingBag className={cn(icon, "text-gold/60")} />
      ) : (
        <Image
          src={image}
          alt={name}
          fill
          sizes={sizes ?? (size === "sm" ? "32px" : size === "md" ? "40px" : size === "lg" ? "56px" : "64px")}
          className="object-cover"
        />
      )}
    </div>
  )
}
