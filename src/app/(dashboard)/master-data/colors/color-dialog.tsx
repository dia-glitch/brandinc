"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createColor, updateColor, deleteColor } from "./actions";

export type ColorData = {
  id: string;
  name: string;
  code: string | null;
  hex: string | null;
  parent_id: string | null;
  is_active: boolean;
};

type ParentOpt = { id: string; name: string };

export function ColorDialog({
  color,
  defaultParentId,
  parents,
  label,
}: {
  color?: ColorData;
  defaultParentId?: string | null;
  parents: ParentOpt[];
  label?: string;
}) {
  const isEdit = Boolean(color);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(color?.name ?? "");
  const [code, setCode] = useState(color?.code ?? "");
  const [hex, setHex] = useState(color?.hex ?? "");
  const [parentId, setParentId] = useState<string>(color?.parent_id ?? defaultParentId ?? "");
  const [active, setActive] = useState(color?.is_active ?? true);

  function close() {
    setOpen(false);
    setConfirmDelete(false);
    setError(null);
    setName(color?.name ?? ""); setCode(color?.code ?? ""); setHex(color?.hex ?? ""); setParentId(color?.parent_id ?? defaultParentId ?? ""); setActive(color?.is_active ?? true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = { name, code, hex, parentId: parentId || null, is_active: active };
      const res = isEdit && color ? await updateColor(color.id, input) : await createColor(input);
      if (!res.ok) { setError(res.error); return; }
      close();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!color) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteColor(color.id);
      if (!res.ok) { setError(res.error); return; }
      close();
      router.refresh();
    });
  }

  const isParentEdit = isEdit && !color?.parent_id;

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
      ) : label ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> {label}
        </Button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Parent Colour Baru
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">
                {isEdit ? "Edit Warna" : parentId ? "Sub Colour Baru" : "Parent Colour Baru"}
              </h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold">Parent Colour</label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40"
                >
                  <option value="">— Jadikan Parent Colour —</option>
                  {parents
                    .filter((p) => p.id !== color?.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold">Nama Warna</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="mis. Blue / Pale Blue" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold">Shade <span className="font-medium text-muted-foreground">(opsional)</span></label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#cccccc"}
                    onChange={(e) => setHex(e.target.value)}
                    className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-border bg-background p-1"
                    aria-label="Pilih shade"
                  />
                  <input value={hex} onChange={(e) => setHex(e.target.value)} className={inputCls} placeholder="#AEC6CF" />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm font-semibold">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-eerie" />
                Aktif
              </label>

              {error && <p className="text-sm font-semibold text-danger">{error}</p>}

              {confirmDelete ? (
                <div className="rounded-xl border border-danger/40 bg-danger/5 p-3">
                  <p className="text-sm font-semibold text-danger">
                    Yakin hapus &quot;{name}&quot;?{isParentEdit && " Sub-warnanya juga ikut terhapus."}
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
