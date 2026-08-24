import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, ArrowRight } from "lucide-react"

export default function NotFound() {
  return (
    <main className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-5 py-20 text-center lg:px-8">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, #FDF0F3 0%, transparent 60%), linear-gradient(180deg, #FFFFFF 0%, #FDF0F3 100%)",
        }}
      />

      <Link href="/" aria-label="HAYDA home" className="mb-10">
        <Image
          src="/logo.png"
          alt="HAYDA SKINCo."
          width={160}
          height={200}
          sizes="(max-width: 768px) 64px, 80px"
          quality={100}
          className="object-contain size-16 md:size-20"
        />
      </Link>

      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-gold">404</p>
      <h1 className="mt-3 font-serif text-4xl font-medium md:text-5xl">Page not found</h1>
      <p className="mt-4 max-w-md text-sm font-light leading-relaxed text-muted-foreground">
        This page doesn&apos;t exist or may have moved. Head back home or browse the shop for your next ritual.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-foreground px-7 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-background transition-colors hover:bg-gold hover:text-gold-foreground"
        >
          <ArrowLeft className="size-3.5" /> Home
        </Link>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 border border-border px-7 py-3.5 text-xs font-medium uppercase tracking-[0.18em] transition-colors hover:border-foreground"
        >
          Shop <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </main>
  )
}
