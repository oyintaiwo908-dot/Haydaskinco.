export default function StorefrontLoading() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
      <div className="mb-10 h-8 w-48 animate-pulse bg-muted/40" />
      <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-4/5 animate-pulse bg-muted/40" />
            <div className="h-3 w-2/3 animate-pulse bg-muted/40" />
            <div className="h-3 w-1/3 animate-pulse bg-muted/30" />
          </div>
        ))}
      </div>
    </div>
  )
}
