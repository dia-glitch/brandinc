"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createMaterial, updateMaterial, deleteMaterial } from "./actions";

export type MaterialData = {
  id: string;
  code: string | null;
  name: string;
  brand_id: string | null;
  category_id: string | null;
  unit: string | null;
  is_active: boolean;
};
type Opt = { id: string; name: string };

const UNITS = ["Meter", "Yard", "Pcs", "Cone", "Roll", "Kg", "Gram", "Lusin", "Set"];

export function MaterialDialog({ material, categories, brands, canEdit = true }: { material?: MaterialData; categories: Opt[]; brands: Opt[]; canEdit?: boolean }) {
  const isEdit = Boolean(material);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(material?.name ?? "");
  const [brandId, setBrandId] = useState<string>(material?.brand_id ?? "");
  const [categoryId, setCategoryId] = useState<string>(material?.category_id ?? "");
  const [unit, setUnit] = useState(material?.unit ?? "");
  const [active, setActive] = useState(material?.is_active ?? true);

  function resetFields() {
    setName(material?.name ?? ""); setBrandId(material?.brand_id ?? "");
    setCategoryId(material?.category_id ?? ""); setUnit(material?.unit ?? ""); setActive(material?.is_active ?? true);
  }
  function close() { setOpen(false); setConfirmDelete(false); setError(null); resetFields(); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = { name, brandId: brandId || null, categoryId: categoryId || null, unit, is_active: active };
      const res = isEdit && material ? await updateMaterial(material.id, input) : await createMaterial(input);
      if (!res.ok) { setError(res.error); return; }
      if (!isEdit) resetFields();
      close(); router.refresh();
    });
  }
  function handleDelete() {
    if (!material) return;
    startTransition(async () => {
      const res = await deleteMaterial(material.id);
      if (!res.ok) { setError(res.error); return; }
      close(); router.refresh();
    });
  }

  if (!canEdit) return null;

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Edit"><Pencil className="h-4 w-4" /></Button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Material Baru</Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{isEdit ? "Edit Material" : "Material Baru"}</h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {isEdit && material ? (
                <div className="rounded-xl bg-muted/60 px-3.5 py-2 text-sm font-semibold">Kode: <span className="font-mono">{material.code}</span></div>
              ) : (
                <p className="text-xs font-medium text-muted-foreground">Kode dibuat otomatis dari kategori (mis. FB-0001).</p>
              )}

              <div>
                <label className={lbl}>Nama Material</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inp} placeholder="mis. Katun Twill / Kancing Kayu 15mm" />
              </div>

              <div>
                <label className={lbl}>Brand</label>
                <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inp + " px-3"}>
                  <option value="">— Pilih Brand —</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Kategori</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inp + " px-3"}>
                    <option value="">— Pilih —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Satuan</label>
                  <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inp + " px-3"}>
                    <option value="">— Pilih —</option>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm font-semibold">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-eerie" /> Aktif
              </label>

              {error && <p className="text-sm font-semibold text-danger">{error}</p>}

              {confirmDelete ? (
                <div className="rounded-xl border border-danger/40 bg-danger/5 p-3">
                  <p className="text-sm font-semibold text-danger">Yakin hapus &quot;{name}&quot;?</p>
                  <div className="mt-2 flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Batal</Button>
                    <Button type="button" variant="danger" size="sm" disabled={pending} onClick={handleDelete}>{pending ? "Menghapus…" : "Ya, Hapus"}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-2">
                  {isEdit ? (
                    <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-sm font-bold text-danger hover:opacity-80"><Trash2 className="h-4 w-4" /> Hapus</button>
                  ) : <span />}
                  <div className="flex gap-2.5">
                    <Button type="button" variant="ghost" size="sm" onClick={close}>Batal</Button>
                    <Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
