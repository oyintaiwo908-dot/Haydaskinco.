export default function ProductLoading() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="aspect-square animate-pulse bg-muted/40" />
        <div className="space-y-4 pt-4">
          <div className="h-3 w-24 animate-pulse bg-muted/40" />
          <div className="h-8 w-3/4 animate-pulse bg-muted/40" />
          <div className="h-4 w-full animate-pulse bg-muted/30" />
          <div className="h-4 w-2/3 animate-pulse bg-muted/30" />
          <div className="mt-8 h-12 w-40 animate-pulse bg-muted/40" />
        </div>
      </div>
    </div>
  )
}
