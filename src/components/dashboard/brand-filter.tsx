"use client";

import { useRouter } from "next/navigation";

export function DashboardBrandFilter({ period, brandId, brands }: { period: string; brandId: string; brands: { id: string; name: string }[] }) {
  const router = useRouter();
  function go(b: string) {
    const params = new URLSearchParams();
    if (period && period !== "month") params.set("period", period);
    if (b) params.set("brand", b);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }
  return (
    <select
      value={brandId}
      onChange={(e) => go(e.target.value)}
      className="h-9 rounded-full border border-border bg-surface px-3.5 text-sm font-bold outline-none focus:border-primary/40"
    >
      <option value="">Semua Brand</option>
      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );
}
