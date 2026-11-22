import type { Metadata } from "next"
import Link from "next/link"
import { DELIVERY_NOTE } from "@/lib/storefront-copy"
import { PageHeader } from "@/components/page-header"

export const metadata: Metadata = {
  title: "FAQs — HAYDA SKINCo.",
  description:
    "Answers on delivery, authenticity, Paystack payments, rewards, and tracking an order at HAYDA SKINCo.",
}

const linkClass = "text-gold underline-offset-2 hover:underline"

export default function FaqPage() {
  return (
    <>
      <PageHeader
        eyebrow="Help"
        title="Frequently asked questions"
        description="Delivery, authenticity, payment, rewards, and how to find an order in your account."
      />

      <div className="mx-auto max-w-3xl px-5 py-16 md:py-20 lg:px-8">
        <div className="space-y-10 text-sm font-light leading-relaxed text-foreground/85">
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-foreground">Delivery</h2>
            <p>{DELIVERY_NOTE}</p>
            <p>
              <Link href="/shipping" className={linkClass}>Delivery details</Link>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-foreground">Authenticity</h2>
            <p>
              Every product is sourced directly from authorised distributors. No fakes, no
              grey-market imports. Descriptions, images, and prices can change, and stock depends
              on availability. If an item cannot be fulfilled, we may cancel or refund the order.
            </p>
            <p>
              <Link href="/about" className={linkClass}>Our story</Link>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-foreground">Payment</h2>
            <p>
              You pay with Paystack. An order is confirmed once payment is successfully verified.
              Prices are in Nigerian naira. We do not store full card numbers.
            </p>
            <p>
              <Link href="/privacy" className={linkClass}>Privacy policy</Link>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-foreground">Rewards</h2>
            <p>
              You earn 1 point per ₦100 spent. Sign in and open Rewards to see your balance and
              redeem points.
            </p>
            <p>
              <Link href="/account/rewards" className={linkClass}>Your rewards</Link>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-foreground">Tracking an order</h2>
            <p>
              Sign in with the email you used at checkout, then open Orders. Each order shows its
              current status. Open an order to see the items, shipping, and total.
            </p>
            <p>
              <Link href="/account/orders" className={linkClass}>Orders</Link>
              {" · "}
              <Link href="/login" className={linkClass}>Sign in</Link>
            </p>
          </section>
        </div>

        <nav className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-[11px] font-light uppercase tracking-[0.14em] text-muted-foreground">
          <Link href="/shipping" className="hover:text-foreground">Delivery</Link>
          <Link href="/returns" className="hover:text-foreground">Returns</Link>
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
        </nav>
      </div>
    </>
  )
}
