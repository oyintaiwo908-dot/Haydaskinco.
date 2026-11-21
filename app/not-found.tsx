import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-[70vh] flex-col items-center justify-center overflow-hidden bg-porcelain px-5 py-20 text-center lg:px-8">
      <div className="hero-light -z-10 opacity-70" aria-hidden />

      <Link href="/" aria-label="HAYDA SKINCo. home" className="mb-10">
        <Image src="/logo.png" alt="" width={160} height={200} sizes="80px" className="size-16 object-contain md:size-20" />
      </Link>

      <p className="text-xs font-medium uppercase tracking-[0.18em] text-rose">404</p>
      <h1 className="mt-3 font-serif text-[clamp(2.25rem,1.7rem+2.2vw,3.5rem)] font-normal text-navy-deep">Page not found</h1>
      <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
        This page doesn&apos;t exist or may have moved. Head back home or browse the shop.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className={buttonVariants()}>
          <ArrowLeft aria-hidden /> Home
        </Link>
        <Link href="/shop" className={buttonVariants({ variant: "outline" })}>
          Shop <ArrowRight aria-hidden />
        </Link>
      </div>
    </main>
  )
}
