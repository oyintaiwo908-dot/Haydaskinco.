import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of Use — HAYDA SKINCo.",
  description: "Terms governing use of the HAYDA SKINCo. website and purchases.",
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 lg:px-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-gold mb-2">Legal</p>
      <h1 className="font-serif text-4xl font-medium">Terms of Use</h1>
      <p className="mt-2 text-sm font-light text-muted-foreground">Last updated: July 2026</p>

      <div className="mt-10 space-y-8 text-sm font-light leading-relaxed text-foreground/85">
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-medium text-foreground">Agreement</h2>
          <p>
            By browsing or purchasing from HAYDA SKINCo., you agree to these terms. If you do not
            agree, please do not use the site.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-medium text-foreground">Products & authenticity</h2>
          <p>
            We source products from authorised channels. Product descriptions, images, and pricing
            may change. Stock is subject to availability; we may cancel or refund if an item cannot
            be fulfilled.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-medium text-foreground">Orders & payment</h2>
          <p>
            Orders are confirmed once payment is successfully verified. Prices are shown in Nigerian
            Naira (₦). Delivery is not included in the amount paid at checkout: it is quoted and
            paid separately after your order, and we will contact you to arrange it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-medium text-foreground">Accounts</h2>
          <p>
            You are responsible for keeping your login credentials secure and for activity under your
            account. Provide accurate shipping and contact details so we can fulfil your orders.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-medium text-foreground">Returns & support</h2>
          <p>
            For damaged, incorrect, or quality issues, contact us promptly with your order reference.
            See{" "}
            <Link href="/contact" className="text-gold underline-offset-2 hover:underline">
              Contact
            </Link>{" "}
            or WhatsApp for help.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-medium text-foreground">Limitation</h2>
          <p>
            To the fullest extent permitted by law, HAYDA SKINCo. is not liable for indirect or
            consequential losses arising from use of the site or delay in delivery beyond our
            reasonable control.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-medium text-foreground">Contact</h2>
          <p>
            <a href="mailto:hello@haydaskinco.com" className="text-gold underline-offset-2 hover:underline">
              hello@haydaskinco.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
