export default function CheckoutLoading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
      <div className="mb-8 h-8 w-48 animate-pulse bg-muted/40" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse bg-muted/40" />
          ))}
        </div>
        <div className="h-64 animate-pulse bg-muted/30" />
      </div>
    </div>
  )
}
