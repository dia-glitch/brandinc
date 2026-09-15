"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Search, Trash2, X } from "lucide-react";
import { formatIDR } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { setCatalogImage } from "./actions";

export type KatalogProduct = {
  id: string; code: string; name: string; retail: number;
  image: string | null; launch: string | null; sizes: string[]; colors: string[];
};
export type KatalogBrand = { id: string; name: string; products: KatalogProduct[] };

type Sort = "code" | "launch_new" | "launch_old";

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function launchLabel(d: string | null): string | null {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return `${MONTHS_ID[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function KatalogView({ brands, canEdit }: { brands: KatalogBrand[]; canEdit: boolean }) {
  const [active, setActive] = useState(brands[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("code");
  const [lightbox, setLightbox] = useState<KatalogProduct | null>(null);

  const brand = brands.find((b) => b.id === active) ?? brands[0];
  const list = useMemo(() => {
    if (!brand) return [];
    const s = q.trim().toLowerCase();
    let arr = brand.products.filter((p) => !s || (p.code + " " + p.name).toLowerCase().includes(s));
    const t = (d: string | null) => (d ? new Date(d).getTime() || 0 : 0);
    arr = [...arr].sort((a, c) => {
      if (sort === "code") return a.code.localeCompare(c.code);
      // launch: produk tanpa tanggal selalu di bawah
      if (!a.launch && !c.launch) return a.code.localeCompare(c.code);
      if (!a.launch) return 1;
      if (!c.launch) return -1;
      return sort === "launch_new" ? t(c.launch) - t(a.launch) : t(a.launch) - t(c.launch);
    });
    return arr;
  }, [brand, q, sort]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">E-Catalog</p>
        <h1 className="text-2xl font-extrabold">🖼️ Katalog Produk</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Foto <b>real</b> produk (bukan foto SPK) — diunggah setelah pemotretan produk selesai.
          Dibagi per brand, bisa dilihat seluruh tim.
        </p>
      </div>

      {brands.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada produk.</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {brands.map((b) => (
                <button key={b.id} onClick={() => setActive(b.id)} data-active={b.id === active} className="pill">
                  {b.name} <span className="ml-1 opacity-60">{b.products.length}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary/40"
              >
                <option value="code">Urut: Kode</option>
                <option value="launch_new">Launch: Terbaru</option>
                <option value="launch_old">Launch: Terlama</option>
              </select>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari kode / nama produk…"
                  className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {list.map((p) => (
              <Card key={p.id} p={p} canEdit={canEdit} onView={() => p.image && setLightbox(p)} />
            ))}
            {list.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm font-medium text-muted-foreground">Tidak ada produk cocok.</p>
            )}
          </div>
        </>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            onClick={() => setLightbox(null)}
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex max-h-[92vh] max-w-3xl flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.image!} alt={lightbox.name} className="max-h-[80vh] w-auto rounded-2xl object-contain" />
            <div className="text-center text-white">
              <p className="text-xs font-bold uppercase tracking-wide opacity-70">{lightbox.code}{launchLabel(lightbox.launch) ? ` · Launch ${launchLabel(lightbox.launch)}` : ""}</p>
              <p className="text-lg font-extrabold">{lightbox.name}</p>
              {lightbox.retail > 0 && <p className="text-sm font-bold opacity-90">{formatIDR(lightbox.retail)}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ p, canEdit, onView }: { p: KatalogProduct; canEdit: boolean; onView: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const launch = launchLabel(p.launch);

  async function onPick(file: File) {
    setErr(null);
    if (!file.type.startsWith("image/")) { setErr("File harus gambar."); return; }
    if (file.size > 5 * 1024 * 1024) { setErr("Maks 5 MB."); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `catalog/${p.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("catalog-images").upload(path, file, { upsert: false });
      if (error) { setErr("Gagal upload. Pastikan bucket 'catalog-images' sudah dibuat."); setBusy(false); return; }
      const { data } = supabase.storage.from("catalog-images").getPublicUrl(path);
      const res = await setCatalogImage(p.id, data.publicUrl);
      if (!res.ok) { setErr(res.error); setBusy(false); return; }
      start(() => router.refresh());
    } catch {
      setErr("Terjadi kesalahan saat upload.");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    setErr(null);
    start(async () => {
      const res = await setCatalogImage(p.id, null);
      if (res.ok) router.refresh(); else setErr(res.error);
    });
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="group relative aspect-[4/5] w-full bg-muted">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image}
            alt={p.name}
            onClick={onView}
            className="h-full w-full cursor-zoom-in object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImagePlus className="h-6 w-6" />
            <span className="text-[11px] font-semibold">Belum ada foto</span>
          </div>
        )}

        {launch && (
          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-eerie/85 px-2 py-0.5 text-[10px] font-bold text-white">
            {launch}
          </span>
        )}

        {canEdit && (
          <div className="absolute inset-x-0 bottom-0 flex gap-1.5 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={busy || pending}
              className="flex-1 rounded-lg bg-white/95 px-2 py-1.5 text-[11px] font-bold text-eerie disabled:opacity-60"
            >
              {busy ? "Mengunggah…" : p.image ? "Ganti" : "Upload"}
            </button>
            {p.image && (
              <button
                onClick={remove}
                disabled={busy || pending}
                className="rounded-lg bg-white/95 px-2 py-1.5 text-[11px] font-bold text-danger disabled:opacity-60"
                title="Hapus foto"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.currentTarget.value = ""; }}
            />
          </div>
        )}
      </div>

      <div className="space-y-1 p-2.5">
        <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">{p.code}</span>
        <p className="text-xs font-bold leading-tight">{p.name}</p>
        {p.sizes.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {p.sizes.map((s) => (
              <span key={s} className="rounded border border-border px-1 py-px text-[9px] font-bold text-muted-foreground">{s}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-xs font-extrabold">{p.retail > 0 ? formatIDR(p.retail) : "—"}</span>
          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Retail</span>
        </div>
        {err && <p className="text-[11px] font-semibold text-danger">{err}</p>}
      </div>
    </div>
  );
}
