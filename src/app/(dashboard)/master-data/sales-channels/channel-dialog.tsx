"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createChannel, updateChannel, deleteChannel } from "./actions";

export type ChannelData = {
  id: string;
  name: string;
  grup: string;
  code: string | null;
  warehouse_id: string | null;
  is_active: boolean;
};
export type WarehouseOpt = { id: string; name: string };

export function ChannelDialog({ channel, warehouses, canEdit = true }: { channel?: ChannelData; warehouses: WarehouseOpt[]; canEdit?: boolean }) {
  const isEdit = Boolean(channel);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(channel?.name ?? "");
  const [grup, setGrup] = useState(channel?.grup ?? "online");
  const [code, setCode] = useState(channel?.code ?? "");
  const [warehouseId, setWarehouseId] = useState(channel?.warehouse_id ?? "");
  const [isActive, setIsActive] = useState(channel?.is_active ?? true);

  function resetFields() {
    setName(channel?.name ?? ""); setGrup(channel?.grup ?? "online"); setCode(channel?.code ?? ""); setWarehouseId(channel?.warehouse_id ?? ""); setIsActive(channel?.is_active ?? true);
  }
  function close() { setOpen(false); setConfirmDelete(false); setError(null); resetFields(); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = { name, grup, code, warehouseId: warehouseId || null, isActive };
      const res = isEdit && channel ? await updateChannel(channel.id, input) : await createChannel(input);
      if (!res.ok) { setError(res.error); return; }
      if (!isEdit) resetFields();
      close(); router.refresh();
    });
  }
  function handleDelete() {
    if (!channel) return;
    startTransition(async () => {
      const res = await deleteChannel(channel.id);
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
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Akun Penjualan Baru</Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{isEdit ? "Edit Akun Penjualan" : "Akun Penjualan Baru"}</h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className={lbl}>Nama Akun</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inp} placeholder="mis. Shopee / Store A" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Grup</label>
                  <select value={grup} onChange={(e) => setGrup(e.target.value)} className={inp + " px-3"}>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Kode <span className="font-medium text-muted-foreground">(opsional)</span></label>
                  <input value={code} onChange={(e) => setCode(e.target.value)} className={inp} placeholder="mis. SHP" />
                </div>
              </div>
              <div>
                <label className={lbl}>Gudang Sumber <span className="font-medium text-muted-foreground">(stok penjualan channel ini)</span></label>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inp + " px-3"}>
                  <option value="">— Semua gudang (tidak dikunci) —</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-border" />
                Aktif
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
