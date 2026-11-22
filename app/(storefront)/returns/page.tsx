import type { Metadata } from "next"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { getWhatsAppDisplay, whatsAppHref } from "@/lib/whatsapp"

export const metadata: Metadata = {
  title: "Returns — HAYDA SKINCo.",
  description:
    "Start a return with HAYDA SKINCo. through the contact form or WhatsApp. Have your order reference ready.",
}

const linkClass = "text-gold underline-offset-2 hover:underline"

export default function ReturnsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Help"
        title="Returns"
        description="For a damaged, incorrect, or quality issue, contact us with your order reference."
      />

      <div className="mx-auto max-w-3xl px-5 py-16 md:py-20 lg:px-8">
        <div className="space-y-10 text-sm font-light leading-relaxed text-foreground/85">
          <p>
            If something arrives damaged, incorrect, or with a quality issue, contact us promptly
            and include your order reference. Tell us what arrived so we can look at it.
          </p>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-foreground">Contact form</h2>
            <p>
              Send the details through the{" "}
              <Link href="/contact" className={linkClass}>contact form</Link>, or email{" "}
              <a href="mailto:hello@haydaskinco.com" className={linkClass}>hello@haydaskinco.com</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-foreground">WhatsApp</h2>
            <p>
              You can also message us on WhatsApp at {getWhatsAppDisplay()}.
            </p>
            <p>
              <a
                href={whatsAppHref("Hi HAYDA SKINCo.! I'd like to start a return.")}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Start a return on WhatsApp
              </a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-foreground">Your order reference</h2>
            <p>
              Sign in and open{" "}
              <Link href="/account/orders" className={linkClass}>Orders</Link>. The reference is
              on the order.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-foreground">Hours</h2>
            <p>Mon – Fri, 9am – 6pm WAT</p>
            <p>Sat, 10am – 3pm WAT</p>
          </section>
        </div>

        <nav className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-[11px] font-light uppercase tracking-[0.14em] text-muted-foreground">
          <Link href="/faq" className="hover:text-foreground">FAQs</Link>
          <Link href="/shipping" className="hover:text-foreground">Delivery</Link>
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
        </nav>
      </div>
    </>
  )
}
