import type { ComponentProps } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Storefront button. Use `buttonVariants()` to style a `<Link>` the same way.
 * Focus styling comes from the global :focus-visible ring in globals.css.
 */
const buttonStyles = cva(
  [
    "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control border text-center",
    "font-sans text-xs font-medium uppercase tracking-[0.14em]",
    "transition-[background-color,border-color,color,scale] duration-200 ease-atelier active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        /** Navy primary call to action. */
        primary: "border-navy bg-navy text-primary-foreground hover:border-navy-deep hover:bg-navy-deep",
        /** Hairline navy outline on light surfaces. */
        outline: "border-navy bg-transparent text-navy hover:bg-navy hover:text-primary-foreground",
        /** White button for navy or image surfaces. */
        light: "border-on-dark bg-on-dark text-navy hover:bg-transparent hover:text-on-dark",
        /** Outline for navy or image surfaces. */
        "outline-light": "border-on-dark/60 bg-transparent text-on-dark hover:border-on-dark hover:bg-on-dark hover:text-navy",
        ghost: "border-transparent bg-transparent text-navy hover:bg-porcelain",
        destructive: "border-destructive bg-transparent text-destructive hover:bg-destructive hover:text-primary-foreground",
        link: "border-transparent text-navy underline decoration-1 underline-offset-4 hover:decoration-2",
      },
      size: {
        sm: "min-h-10 px-4 py-2",
        md: "min-h-12 px-6 py-2.5",
        lg: "min-h-14 px-8 py-3",
      },
      /** Full width; long labels wrap instead of clipping on narrow phones. */
      block: {
        true: "w-full whitespace-normal",
      },
    },
    compoundVariants: [{ variant: "link", className: "min-h-0 px-0 py-0" }],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
)

type ButtonVariantProps = VariantProps<typeof buttonStyles>

/** Class string for a button-styled element (merged, so overrides win). */
function buttonVariants(props?: ButtonVariantProps & { className?: string }) {
  const { className, ...variants } = props ?? {}
  return cn(buttonStyles(variants), className)
}

type ButtonProps = ComponentProps<"button"> & ButtonVariantProps

function Button({ className, variant, size, block, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      className={buttonVariants({ variant, size, block, className })}
      {...props}
    />
  )
}

export { Button, buttonVariants, type ButtonProps }
