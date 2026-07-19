"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COA_TYPE_LABEL, COA_TYPE_ORDER } from "@/lib/coa";
import { createCoa, updateCoa, deleteCoa } from "./actions";

export type CoaData = { id: string; code: string; name: string; type: string };

export function CoaDialog({ account }: { account?: CoaData }) {
  const isEdit = Boolean(account);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [code, setCode] = useState(account?.code ?? "");
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "expense");

  function resetFields() { setCode(account?.code ?? ""); setName(account?.name ?? ""); setType(account?.type ?? "expense"); }
  function close() { setOpen(false); setConfirmDelete(false); setError(null); resetFields(); }

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    startTransition(async () => {
      const res = isEdit && account ? await updateCoa(account.id, { code, name, type }) : await createCoa({ code, name, type });
      if (!res.ok) { setError(res.error); return; }
      if (!isEdit) resetFields();
      close(); router.refresh();
    });
  }

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Edit"><Pencil className="h-4 w-4" /></Button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Akun Baru</Button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-extrabold">{isEdit ? "Edit Akun" : "Akun Baru"}</h2><button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Kode</label><input required value={code} onChange={(e) => setCode(e.target.value)} className={inp} placeholder="mis. 6101" /></div>
                <div><label className={lbl}>Tipe</label><select value={type} onChange={(e) => setType(e.target.value)} className={inp + " px-3"}>{COA_TYPE_ORDER.map((t) => <option key={t} value={t}>{COA_TYPE_LABEL[t]}</option>)}</select></div>
              </div>
              <div><label className={lbl}>Nama Akun</label><input required value={name} onChange={(e) => setName(e.target.value)} className={inp} placeholder="mis. Komisi Channel" /></div>
              {error && <p className="text-sm font-semibold text-danger">{error}</p>}
              {confirmDelete ? (
                <div className="rounded-xl border border-danger/40 bg-danger/5 p-3">
                  <p className="text-sm font-semibold text-danger">Yakin hapus &quot;{name}&quot;?</p>
                  <div className="mt-2 flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Batal</Button><Button type="button" variant="danger" size="sm" disabled={pending} onClick={() => startTransition(async () => { if (account) await deleteCoa(account.id); close(); router.refresh(); })}>{pending ? "Menghapus…" : "Ya, Hapus"}</Button></div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-2">
                  {isEdit ? <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-sm font-bold text-danger hover:opacity-80"><Trash2 className="h-4 w-4" /> Hapus</button> : <span />}
                  <div className="flex gap-2.5"><Button type="button" variant="ghost" size="sm" onClick={close}>Batal</Button><Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button></div>
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
