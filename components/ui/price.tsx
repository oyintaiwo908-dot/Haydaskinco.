import { cn } from "@/lib/utils"
import { MoneyTicker } from "@/components/motion/money-ticker"

const NGN = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })

/**
 * A naira amount. The ₦ sign renders in `.currency` (Cormorant, which carries the glyph)
 * so it looks the same on Mac, Windows, Android and iOS; digits stay in the body font.
 * Text content is unchanged ("₦8,900"), so screen readers and copy/paste are unaffected.
 */
export function Money({ amount, className }: { amount: number; className?: string }) {
  const parts = NGN.formatToParts(amount)
  const symbol = parts.filter(p => p.type === "currency").map(p => p.value).join("") || "₦"
  const sign = parts.find(p => p.type === "minusSign")?.value ?? ""
  const digits = parts
    .filter(p => p.type !== "currency" && p.type !== "minusSign" && p.type !== "literal")
    .map(p => p.value)
    .join("")
  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)}>
      {sign}
      <span className="currency">{symbol}</span>
      {digits}
    </span>
  )
}

const sizes = {
  sm: "text-sm",
  md: "text-base",
  lg: "font-serif text-2xl md:text-3xl",
} as const

/**
 * Naira price with an optional struck-through original. Sale prices use the
 * rose token; screen readers hear "Was … now …" instead of two bare numbers.
 */
export function Price({
  amount,
  compareAt,
  size = "md",
  suffix,
  className,
  ticker = false,
}: {
  /** Price the customer pays. */
  amount: number
  /** Original price; shown struck through only when higher than `amount`. */
  compareAt?: number | null
  size?: keyof typeof sizes
  /** Small trailing note, e.g. "/ unit". */
  suffix?: string
  className?: string
  /** Roll to new values (PDP price as quantity or size changes). */
  ticker?: boolean
}) {
  const onSale = typeof compareAt === "number" && compareAt > amount

  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 tabular-nums", sizes[size], className)}>
      {onSale ? (
        <>
          <span className="sr-only">
            Was {NGN.format(compareAt)}, now {NGN.format(amount)}
          </span>
          <s aria-hidden className="text-[0.85em] text-muted-foreground decoration-1">
            <Money amount={compareAt} />
          </s>
          <span aria-hidden className="font-medium text-rose">
            {ticker ? <MoneyTicker amount={amount} /> : <Money amount={amount} />}
          </span>
        </>
      ) : (
        <span className="font-medium text-foreground">
          {ticker ? <MoneyTicker amount={amount} /> : <Money amount={amount} />}
        </span>
      )}
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </p>
  )
}
