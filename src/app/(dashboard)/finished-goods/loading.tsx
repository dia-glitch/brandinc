// Skeleton konten (di bawah tab bar) — tampil instan saat pindah antar-tab modul.
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-4">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-7 w-56 rounded-lg bg-muted" />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-10 flex-1 min-w-[200px] rounded-xl bg-muted" />
        <div className="h-10 w-40 rounded-xl bg-muted" />
      </div>
      <div className="card p-0">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border/60 px-5 py-4 last:border-0">
            <div className="h-4 w-44 rounded bg-muted" />
            <div className="hidden h-4 w-28 rounded bg-muted sm:block" />
            <div className="ml-auto h-4 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
