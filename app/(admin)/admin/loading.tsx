export default function AdminLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-56 animate-pulse rounded bg-muted/40" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded bg-muted/40" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded bg-muted/30" />
    </div>
  )
}
