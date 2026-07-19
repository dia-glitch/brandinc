"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createProductWithVariants } from "./actions";

export type BrandOpt = { id: string; name: string; code: string };
export type ParentOpt = { id: string; name: string };
export type CatSub = { id: string; name: string; code: string; parentId: string };
export type ColorSub = { id: string; name: string; parentId: string };
export type SizeOpt = { id: string; name: string };

export function ProductForm({
  brands, catParents, catSubs, colorParents, colorSubs, sizes, canEdit = true,
}: {
  brands: BrandOpt[];
  catParents: ParentOpt[];
  catSubs: CatSub[];
  colorParents: ParentOpt[];
  colorSubs: ColorSub[];
  sizes: SizeOpt[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [brandId, setBrandId] = useState("");
  const [rawName, setRawName] = useState("");
  const [catParentId, setCatParentId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [colorParentId, setColorParentId] = useState("");
  const [colorId, setColorId] = useState("");
  const [sizeIds, setSizeIds] = useState<Set<string>>(new Set());

  const brand = brands.find((b) => b.id === brandId);
  const cat = catSubs.find((c) => c.id === categoryId);
  const color = colorSubs.find((c) => c.id === colorId);

  const catOptions = useMemo(() => catSubs.filter((c) => c.parentId === catParentId), [catSubs, catParentId]);
  const colorOptions = useMemo(() => colorSubs.filter((c) => c.parentId === colorParentId), [colorSubs, colorParentId]);

  const previewName = useMemo(() => {
    if (!rawName && !cat && !color) return "—";
    return [rawName.trim(), cat?.name, color?.name].filter(Boolean).join(" ");
  }, [rawName, cat, color]);
  const previewSku = brand && cat ? `${brand.code.toUpperCase()}-${cat.code.toUpperCase()}###-<ukuran>` : "—";

  if (!canEdit) return null;

  function reset() {
    setBrandId(""); setRawName(""); setCatParentId(""); setCategoryId("");
    setColorParentId(""); setColorId(""); setSizeIds(new Set()); setError(null);
  }
  function close() { setOpen(false); reset(); }
  function toggleSize(id: string) {
    setSizeIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!brand || !cat || !color) { setError("Lengkapi Brand, Kategori, dan Warna."); return; }
    const chosen = sizes.filter((s) => sizeIds.has(s.id)).map((s) => ({ id: s.id, name: s.name }));
    if (chosen.length === 0) { setError("Pilih minimal satu ukuran."); return; }
    startTransition(async () => {
      const res = await createProductWithVariants({
        brandId: brand.id, brandCode: brand.code,
        categoryId: cat.id, categoryCode: cat.code, categoryName: cat.name,
        colorId: color.id, colorName: color.name,
        rawName, sizes: chosen,
      });
      if (!res.ok) { setError(res.error); return; }
      close();
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Produk Baru
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Produk Baru</h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className={lbl}>Brand</label>
                <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={sel}>
                  <option value="">— Pilih Brand —</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                </select>
              </div>

              <div>
                <label className={lbl}>Nama Produk</label>
                <input value={rawName} onChange={(e) => setRawName(e.target.value)} className={inp} placeholder="mis. Alina" required />
              </div>

              {/* Kategori: LV1 -> LV2 */}
              <div>
                <label className={lbl}>Kategori</label>
                <div className="grid grid-cols-2 gap-3">
                  <select value={catParentId} onChange={(e) => { setCatParentId(e.target.value); setCategoryId(""); }} className={sel}>
                    <option value="">— Kategori Utama —</option>
                    {catParents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={sel} disabled={!catParentId}>
                    <option value="">{catParentId ? "— Sub Kategori —" : "pilih utama dulu"}</option>
                    {catOptions.map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ""}</option>)}
                  </select>
                </div>
              </div>

              {/* Warna: LV1 -> LV2 */}
              <div>
                <label className={lbl}>Warna</label>
                <div className="grid grid-cols-2 gap-3">
                  <select value={colorParentId} onChange={(e) => { setColorParentId(e.target.value); setColorId(""); }} className={sel}>
                    <option value="">— Parent Colour —</option>
                    {colorParents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={colorId} onChange={(e) => setColorId(e.target.value)} className={sel} disabled={!colorParentId}>
                    <option value="">{colorParentId ? "— Sub Colour —" : "pilih parent dulu"}</option>
                    {colorOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={lbl}>Ukuran (pilih beberapa)</label>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <button type="button" key={s.id} onClick={() => toggleSize(s.id)} data-on={sizeIds.has(s.id)}
                      className="rounded-full border border-border px-3.5 py-1.5 text-sm font-bold text-muted-foreground data-[on=true]:border-transparent data-[on=true]:bg-primary data-[on=true]:text-primary-foreground">
                      {s.name}
                    </button>
                  ))}
                  {sizes.length === 0 && <span className="text-sm text-muted-foreground">Belum ada master ukuran.</span>}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
                <p><span className="font-semibold text-muted-foreground">Nama tercatat:</span> <b>{previewName}</b></p>
                <p className="mt-1"><span className="font-semibold text-muted-foreground">Pola SKU:</span> <b className="font-mono">{previewSku}</b></p>
              </div>

              {error && <p className="text-sm font-semibold text-danger">{error}</p>}

              <div className="flex justify-end gap-2.5 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={close}>Batal</Button>
                <Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Buat Produk"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
const sel = inp + " px-3";
