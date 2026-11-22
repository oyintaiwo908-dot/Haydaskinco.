import type { Metadata } from "next"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { DELIVERY_NOTE, DELIVERY_SHORT } from "@/lib/storefront-copy"

export const metadata: Metadata = {
  title: "Delivery — HAYDA SKINCo.",
  description: `${DELIVERY_SHORT}. ${DELIVERY_NOTE}`,
}

const linkClass = "text-gold underline-offset-2 hover:underline"

export default function ShippingPage() {
  return (
    <>
      <PageHeader eyebrow="Help" title="Delivery" description={`${DELIVERY_SHORT}.`} />

      <div className="mx-auto max-w-3xl px-5 py-16 md:py-20 lg:px-8">
        <div className="space-y-4 text-sm font-light leading-relaxed text-foreground/85">
          <h2 className="font-serif text-xl font-medium text-foreground">How delivery works</h2>
          <p>{DELIVERY_NOTE}</p>
          <p>
            We use the phone number and email address you give at checkout to reach you, so please
            check they are correct.
          </p>
          <p>
            After you pay, the status of the order is listed under{" "}
            <Link href="/account/orders" className={linkClass}>Orders</Link> in your account.
          </p>
        </div>

        <nav className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-[11px] font-light uppercase tracking-[0.14em] text-muted-foreground">
          <Link href="/faq" className="hover:text-foreground">FAQs</Link>
          <Link href="/returns" className="hover:text-foreground">Returns</Link>
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
        </nav>
      </div>
    </>
  )
}
