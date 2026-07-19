"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createCategory, updateCategory, deleteCategory } from "./actions";

export type CategoryData = {
  id: string;
  name: string;
  code: string;
  parent_id: string | null;
  is_active: boolean;
};

type ParentOpt = { id: string; name: string };

export function CategoryDialog({
  category,
  defaultParentId,
  parents,
  label,
  canEdit = true,
}: {
  category?: CategoryData;
  defaultParentId?: string | null;
  parents: ParentOpt[];
  label?: string;
  canEdit?: boolean;
}) {
  const isEdit = Boolean(category);
  const isParent = isEdit && !category?.parent_id;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(category?.name ?? "");
  const [code, setCode] = useState(category?.code ?? "");
  const [parentId, setParentId] = useState<string>(category?.parent_id ?? defaultParentId ?? "");
  const [active, setActive] = useState(category?.is_active ?? true);

  function close() {
    setOpen(false);
    setConfirmDelete(false);
    setError(null);
    setName(category?.name ?? ""); setCode(category?.code ?? ""); setParentId(category?.parent_id ?? defaultParentId ?? ""); setActive(category?.is_active ?? true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = { name, code, parentId: parentId || null, is_active: active };
      const res = isEdit && category
        ? await updateCategory(category.id, input)
        : await createCategory(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!category) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteCategory(category.id);
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
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      ) : label ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> {label}
        </Button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Kategori Baru
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">
                {isEdit ? "Edit Kategori" : parentId ? "Sub-kategori Baru" : "Kategori Baru"}
              </h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold">Induk (Kategori Utama)</label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40"
                >
                  <option value="">— Jadikan Kategori Utama —</option>
                  {parents
                    .filter((p) => p.id !== category?.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold">Nama</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="mis. Tops / Shirt" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold">Kode</label>
                <input required value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} placeholder="mis. CAT-TOPS" />
              </div>

              <label className="flex items-center gap-2.5 text-sm font-semibold">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-eerie" />
                Aktif
              </label>

              {error && <p className="text-sm font-semibold text-danger">{error}</p>}

              {confirmDelete ? (
                <div className="rounded-xl border border-danger/40 bg-danger/5 p-3">
                  <p className="text-sm font-semibold text-danger">
                    Yakin hapus &quot;{name}&quot;?
                    {isParent && " Sub-kategorinya juga ikut terhapus."}
                  </p>
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
