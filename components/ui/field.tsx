"use client"

import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type FieldContextValue = {
  id: string
  describedBy?: string
  invalid: boolean
  required: boolean
}

const FieldContext = createContext<FieldContextValue | null>(null)

/** Shared control styling. 16px text stops iOS zooming on focus. */
const controlClass = cn(
  "w-full rounded-control border border-input bg-background px-4 text-base text-foreground",
  "placeholder:text-muted-foreground transition-colors duration-200 ease-atelier hover:border-navy",
  "disabled:cursor-not-allowed disabled:bg-porcelain disabled:opacity-70",
  "aria-[invalid=true]:border-destructive",
)

/**
 * Label + control + hint + error, wired together: the control gets `id`,
 * `aria-describedby`, `aria-invalid` and `required` from context.
 *
 *   <Field label="Email" hint="For your receipt" error={errors.email} required>
 *     <Input type="email" autoComplete="email" />
 *   </Field>
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  id: idProp,
  className,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  id?: string
  className?: string
  children: ReactNode
}) {
  const autoId = useId()
  const id = idProp ?? `field-${autoId}`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required }}>
      <div className={cn("flex flex-col gap-2", className)}>
        <label htmlFor={id} className="text-xs font-medium uppercase tracking-[0.14em] text-foreground">
          {label}
          {required && (
            <span aria-hidden className="ml-0.5 text-rose">
              *
            </span>
          )}
        </label>
        {children}
        {hint && (
          <p id={hintId} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
        <p id={errorId} aria-live="polite" className={cn("text-sm text-destructive", !error && "sr-only")}>
          {error}
        </p>
      </div>
    </FieldContext.Provider>
  )
}

function useFieldControl(props: { id?: string; required?: boolean; "aria-describedby"?: string }) {
  const field = useContext(FieldContext)
  if (!field) return {}
  return {
    id: props.id ?? field.id,
    required: props.required ?? field.required,
    "aria-invalid": field.invalid || undefined,
    "aria-describedby": [field.describedBy, props["aria-describedby"]].filter(Boolean).join(" ") || undefined,
  }
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  const wired = useFieldControl(props)
  return <input {...props} {...wired} className={cn(controlClass, "h-12", className)} />
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  const wired = useFieldControl(props)
  return <textarea {...props} {...wired} className={cn(controlClass, "min-h-32 py-3", className)} />
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  const wired = useFieldControl(props)
  return (
    <div className="relative">
      <select {...props} {...wired} className={cn(controlClass, "h-12 cursor-pointer appearance-none pr-10", className)}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}
