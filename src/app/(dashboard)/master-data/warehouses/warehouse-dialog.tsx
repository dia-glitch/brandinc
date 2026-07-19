"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createWarehouse, updateWarehouse, deleteWarehouse } from "./actions";
import { KINDS } from "./kinds";

export type WarehouseData = {
  id: string;
  code: string | null;
  name: string;
  kind: string;
  brand_id: string | null;
};
type Opt = { id: string; name: string };

export function WarehouseDialog({ warehouse, brands, canEdit = true }: { warehouse?: WarehouseData; brands: Opt[]; canEdit?: boolean }) {
  const isEdit = Boolean(warehouse);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(warehouse?.name ?? "");
  const [code, setCode] = useState(warehouse?.code ?? "");
  const [kind, setKind] = useState(warehouse?.kind ?? "finished");
  const [brandId, setBrandId] = useState<string>(warehouse?.brand_id ?? "");

  function resetFields() {
    setName(warehouse?.name ?? ""); setCode(warehouse?.code ?? ""); setKind(warehouse?.kind ?? "finished"); setBrandId(warehouse?.brand_id ?? "");
  }
  function close() { setOpen(false); setConfirmDelete(false); setError(null); resetFields(); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = { name, code, kind, brandId: brandId || null };
      const res = isEdit && warehouse ? await updateWarehouse(warehouse.id, input) : await createWarehouse(input);
      if (!res.ok) { setError(res.error); return; }
      if (!isEdit) resetFields();
      close(); router.refresh();
    });
  }
  function handleDelete() {
    if (!warehouse) return;
    startTransition(async () => {
      const res = await deleteWarehouse(warehouse.id);
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
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Gudang Baru</Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{isEdit ? "Edit Gudang" : "Gudang Baru"}</h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className={lbl}>Nama Gudang</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inp} placeholder="mis. Gudang Elle & Ello" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Jenis</label>
                  <select value={kind} onChange={(e) => setKind(e.target.value)} className={inp + " px-3"}>
                    {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Kode</label>
                  <input value={code} onChange={(e) => setCode(e.target.value)} className={inp} placeholder="opsional" />
                </div>
              </div>
              <div>
                <label className={lbl}>Brand</label>
                <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inp + " px-3"}>
                  <option value="">— Umum / Semua Brand —</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

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
