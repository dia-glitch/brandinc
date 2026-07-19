"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBrand, updateBrand, deleteBrand } from "./actions";

export type BrandData = {
  id: string;
  name: string;
  code: string;
  segment: string | null;
  is_active: boolean;
};

export function BrandDialog({ brand, canEdit = true }: { brand?: BrandData; canEdit?: boolean }) {
  const isEdit = Boolean(brand);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(brand?.name ?? "");
  const [code, setCode] = useState(brand?.code ?? "");
  const [segment, setSegment] = useState(brand?.segment ?? "");
  const [active, setActive] = useState(brand?.is_active ?? true);

  function close() {
    setOpen(false);
    setConfirmDelete(false);
    setError(null);
    setName(brand?.name ?? ""); setCode(brand?.code ?? ""); setSegment(brand?.segment ?? ""); setActive(brand?.is_active ?? true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = { name, code, segment, is_active: active };
      const res = isEdit && brand ? await updateBrand(brand.id, input) : await createBrand(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!brand) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteBrand(brand.id);
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
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Brand Baru
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{isEdit ? "Edit Brand" : "Brand Baru"}</h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <Field label="Nama Brand">
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="mis. Aurelia" />
              </Field>
              <Field label="Kode">
                <input required value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} placeholder="mis. BRD-A" />
              </Field>
              <Field label="Segmen">
                <input value={segment} onChange={(e) => setSegment(e.target.value)} className={inputCls} placeholder="mis. Womenswear" />
              </Field>

              <label className="flex items-center gap-2.5 text-sm font-semibold">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-eerie" />
                Aktif
              </label>

              {error && <p className="text-sm font-semibold text-danger">{error}</p>}

              {confirmDelete ? (
                <div className="rounded-xl border border-danger/40 bg-danger/5 p-3">
                  <p className="text-sm font-semibold text-danger">Yakin hapus brand &quot;{name}&quot;?</p>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold">{label}</label>
      {children}
    </div>
  );
}
