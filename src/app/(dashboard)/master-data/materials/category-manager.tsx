"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings2, X, Plus, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createMaterialCategory, updateMaterialCategory, deleteMaterialCategory } from "./actions";

export type MaterialCategory = { id: string; name: string };

export function CategoryManager({ categories }: { categories: MaterialCategory[] }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function add() {
    if (!newName.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await createMaterialCategory(newName);
      if (!res.ok) { setError(res.error); return; }
      setNewName(""); router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Settings2 className="h-4 w-4" /> Kelola Kategori</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Kategori Material</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-4 flex gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
                className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40" placeholder="Tambah kategori baru…" />
              <Button type="button" size="sm" onClick={add} disabled={pending}><Plus className="h-4 w-4" /> Tambah</Button>
            </div>
            {error && <p className="mb-3 text-sm font-semibold text-danger">{error}</p>}
            <div className="space-y-2">
              {categories.length === 0 ? (
                <p className="py-6 text-center text-sm font-medium text-muted-foreground">Belum ada kategori.</p>
              ) : categories.map((c) => <Row key={c.id} category={c} />)}
            </div>
            <div className="mt-5 flex justify-end"><Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Tutup</Button></div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ category }: { category: MaterialCategory }) {
  const [name, setName] = useState(category.name);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  const changed = name.trim() !== category.name;

  return (
    <div className="flex items-center gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)}
        className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary/40" />
      {changed && (
        <button type="button" onClick={() => startTransition(async () => { await updateMaterialCategory(category.id, name); router.refresh(); })} disabled={pending}
          title="Simpan" className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Check className="h-4 w-4" /></button>
      )}
      {confirm ? (
        <button type="button" onClick={() => startTransition(async () => { await deleteMaterialCategory(category.id); router.refresh(); })} disabled={pending}
          className="rounded-xl bg-danger px-3 py-2 text-xs font-bold text-white">Hapus?</button>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} title="Hapus" className="grid h-10 w-10 place-items-center rounded-xl border border-border text-danger hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
      )}
    </div>
  );
}
