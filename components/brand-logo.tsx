import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * The HAYDA SKINCo. wordmark from /public/logo.png. That file is a 1080×1350 portrait canvas
 * whose lettering fills only a 995×493 band in the middle, so `object-contain` in a square
 * shrank the letters to a few pixels. This frame has the lettering's own aspect ratio and
 * crops the transparent padding (same asset, no new artwork); size it by height.
 */
const ART = { canvasW: 1080, canvasH: 1350, left: 38, top: 382, width: 995, height: 493 }

export function BrandLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span
      className={cn("relative block overflow-hidden", className)}
      style={{ aspectRatio: `${ART.width} / ${ART.height}` }}
    >
      <Image
        src="/logo.png"
        alt=""
        width={ART.canvasW}
        height={ART.canvasH}
        sizes="160px"
        priority={priority}
        className="absolute max-w-none"
        style={{
          width: `${(ART.canvasW / ART.width) * 100}%`,
          height: "auto",
          left: `${(-ART.left / ART.width) * 100}%`,
          top: `${(-ART.top / ART.height) * 100}%`,
        }}
      />
    </span>
  )
}
