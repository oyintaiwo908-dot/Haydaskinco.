import type { ComponentProps, ReactNode } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const iconButtonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center rounded-control border",
    "transition-[background-color,border-color,color,scale] duration-200 ease-atelier active:scale-[0.96]",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  ],
  {
    variants: {
      variant: {
        ghost: "border-transparent bg-transparent text-navy hover:bg-porcelain",
        outline: "border-input bg-background text-navy hover:border-navy",
        solid: "border-navy bg-navy text-primary-foreground hover:bg-navy-deep",
        "on-dark": "border-transparent bg-transparent text-on-dark hover:bg-on-dark/10",
      },
      /** md and lg meet the 44px touch target; sm is for dense desktop toolbars. */
      size: {
        sm: "size-9",
        md: "size-11",
        lg: "size-12",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
)

type IconButtonProps = Omit<ComponentProps<"button">, "aria-label" | "children"> &
  VariantProps<typeof iconButtonVariants> & {
    /** Accessible name. Required: an icon alone has no name. */
    label: string
    children: ReactNode
    /** Optional count badge, e.g. bag items. Hidden from assistive tech; put the count in `label`. */
    badge?: number
  }

function IconButton({ label, badge, className, variant, size, type = "button", children, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span
          key={badge}
          aria-hidden
          className="badge-pop absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-navy px-1 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums"
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  )
}

export { IconButton, iconButtonVariants, type IconButtonProps }
