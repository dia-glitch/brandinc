"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSize, updateSize, deleteSize } from "./actions";

export type SizeData = {
  id: string;
  name: string;
  code: string | null;
  sort_order: number;
  is_active: boolean;
};

export function SizeDialog({ size, canEdit = true }: { size?: SizeData; canEdit?: boolean }) {
  const isEdit = Boolean(size);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(size?.name ?? "");
  const [code, setCode] = useState(size?.code ?? "");
  const [order, setOrder] = useState<string>(size ? String(size.sort_order) : "");
  const [active, setActive] = useState(size?.is_active ?? true);

  function close() {
    setOpen(false);
    setConfirmDelete(false);
    setError(null);
    setName(size?.name ?? ""); setCode(size?.code ?? ""); setOrder(size ? String(size.sort_order) : ""); setActive(size?.is_active ?? true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = { name, code, sortOrder: Number(order) || 0, is_active: active };
      const res = isEdit && size ? await updateSize(size.id, input) : await createSize(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!size) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteSize(size.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  if (!canEdit) return null;

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Ukuran Baru
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{isEdit ? "Edit Ukuran" : "Ukuran Baru"}</h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold">Ukuran</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="mis. M / S/M / 1-2y" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-bold">Kode <span className="font-medium text-muted-foreground">(opsional)</span></label>
                  <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} placeholder="mis. M" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold">Urutan</label>
                  <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} className={inputCls} placeholder="otomatis" />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm font-semibold">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-eerie" />
                Aktif
              </label>

              {error && <p className="text-sm font-semibold text-danger">{error}</p>}

              {confirmDelete ? (
                <div className="rounded-xl border border-danger/40 bg-danger/5 p-3">
                  <p className="text-sm font-semibold text-danger">Yakin hapus ukuran &quot;{name}&quot;?</p>
                  <div className="mt-2 flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Batal</Button>
                    <Button type="button" variant="danger" size="sm" disabled={pending} onClick={handleDelete}>
                      {pending ? "Menghapus…" : "Ya, Hapus"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-2">
                  {isEdit ? (
                    <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-sm font-bold text-danger hover:opacity-80">
                      <Trash2 className="h-4 w-4" /> Hapus
                    </button>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-2.5">
                    <Button type="button" variant="ghost" size="sm" onClick={close}>Batal</Button>
                    <Button type="submit" size="sm" disabled={pending}>
                      {pending ? "Menyimpan…" : "Simpan"}
                    </Button>
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

const inputCls =
  "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
