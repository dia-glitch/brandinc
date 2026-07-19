"use client";

import { Search } from "lucide-react";

/** Filter bar standar: search + filter brand + reset + penghitung. */
export function ListFilter({ q, setQ, brandFilter, setBrandFilter, brandOpts, count, unit, placeholder }: {
  q: string; setQ: (v: string) => void; brandFilter: string; setBrandFilter: (v: string) => void;
  brandOpts: string[]; count: number; unit: string; placeholder: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
      </div>
      <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
        <option value="">Semua Brand</option>
        {brandOpts.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>
      {(q || brandFilter) && <button onClick={() => { setQ(""); setBrandFilter(""); }} className="h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted">Reset</button>}
      <span className="ml-auto self-center text-sm font-medium text-muted-foreground">{count} {unit}</span>
    </div>
  );
}
