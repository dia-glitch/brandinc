"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createCategory, updateCategory, deleteCategory } from "./actions";

export type CategoryData = {
  id: string;
  name: string;
  code: string | null;
  coa_code: string | null;
  is_active: boolean;
};

export function CategoryDialog({ category }: { category?: CategoryData }) {
  const isEdit = Boolean(category);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(category?.name ?? "");
  const [code, setCode] = useState(category?.code ?? "");
  const [coaCode, setCoaCode] = useState(category?.coa_code ?? "");
  const [isActive, setIsActive] = useState(category?.is_active ?? true);

  function resetFields() {
    setName(category?.name ?? ""); setCode(category?.code ?? ""); setCoaCode(category?.coa_code ?? ""); setIsActive(category?.is_active ?? true);
  }
  function close() { setOpen(false); setConfirmDelete(false); setError(null); resetFields(); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = { name, code, coaCode, isActive };
      const res = isEdit && category ? await updateCategory(category.id, input) : await createCategory(input);
      if (!res.ok) { setError(res.error); return; }
      if (!isEdit) resetFields();
      close(); router.refresh();
    });
  }
  function handleDelete() {
    if (!category) return;
    startTransition(async () => {
      const res = await deleteCategory(category.id);
      if (!res.ok) { setError(res.error); return; }
      close(); router.refresh();
    });
  }

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Edit"><Pencil className="h-4 w-4" /></Button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Kategori Baru</Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{isEdit ? "Edit Kategori" : "Kategori Baru"}</h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className={lbl}>Nama Kategori</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inp} placeholder="mis. Raw Material" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Kode <span className="font-medium text-muted-foreground">(opsional)</span></label>
                  <input value={code} onChange={(e) => setCode(e.target.value)} className={inp} placeholder="mis. RM" />
                </div>
                <div>
                  <label className={lbl}>Kode COA <span className="font-medium text-muted-foreground">(opsional)</span></label>
                  <input value={coaCode} onChange={(e) => setCoaCode(e.target.value)} className={inp} placeholder="mis. 5101" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-border" />
                Aktif (muncul di pilihan Expense &amp; Payment Request)
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
