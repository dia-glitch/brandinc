"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupplier, updateSupplier, deleteSupplier } from "./actions";

export type SupplierData = {
  id: string;
  name: string;
  code: string;
  category_id: string | null;
  phone: string | null;
  email: string | null;
  is_taxable: boolean;
  npwp: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  is_active: boolean;
};

type CatOpt = { id: string; name: string };

export function SupplierDialog({ supplier, categories, canEdit = true }: { supplier?: SupplierData; categories: CatOpt[]; canEdit?: boolean }) {
  const isEdit = Boolean(supplier);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(supplier?.name ?? "");
  const [categoryId, setCategoryId] = useState<string>(supplier?.category_id ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [taxable, setTaxable] = useState(supplier?.is_taxable ?? false);
  const [npwp, setNpwp] = useState(supplier?.npwp ?? "");
  const [bankName, setBankName] = useState(supplier?.bank_name ?? "");
  const [bankNo, setBankNo] = useState(supplier?.bank_account_no ?? "");
  const [bankHolder, setBankHolder] = useState(supplier?.bank_account_name ?? "");
  const [active, setActive] = useState(supplier?.is_active ?? true);

  function close() {
    setOpen(false);
    setConfirmDelete(false);
    setError(null);
    setName(supplier?.name ?? ""); setCategoryId(supplier?.category_id ?? ""); setPhone(supplier?.phone ?? ""); setEmail(supplier?.email ?? "");
    setTaxable(supplier?.is_taxable ?? false); setNpwp(supplier?.npwp ?? ""); setBankName(supplier?.bank_name ?? "");
    setBankNo(supplier?.bank_account_no ?? ""); setBankHolder(supplier?.bank_account_name ?? ""); setActive(supplier?.is_active ?? true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = {
        name, categoryId: categoryId || null, phone, email,
        is_taxable: taxable, npwp, bankName, bankAccountNo: bankNo, bankAccountName: bankHolder,
        is_active: active,
      };
      const res = isEdit && supplier ? await updateSupplier(supplier.id, input) : await createSupplier(input);
      if (!res.ok) { setError(res.error); return; }
      close();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!supplier) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteSupplier(supplier.id);
      if (!res.ok) { setError(res.error); return; }
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
          <Plus className="h-4 w-4" /> Supplier Baru
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{isEdit ? "Edit Supplier" : "Supplier Baru"}</h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold">Nama Supplier</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="mis. PT Kain Sejahtera" />
              </div>

              {isEdit && supplier ? (
                <div className="rounded-xl bg-muted/60 px-3.5 py-2 text-sm font-semibold">
                  Kode: <span className="font-mono">{supplier.code}</span>
                </div>
              ) : (
                <p className="text-xs font-medium text-muted-foreground">Kode supplier dibuat otomatis (SUP-0001, SUP-0002, …).</p>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-bold">Kategori</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls + " px-3"}>
                  <option value="">— Pilih —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-bold">Telepon <span className="font-medium text-muted-foreground">(opsional)</span></label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="08xx" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold">Email <span className="font-medium text-muted-foreground">(opsional)</span></label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="a@b.com" />
                </div>
              </div>

              {/* Pajak & Bank — untuk Finance */}
              <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-4">
                <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Pajak &amp; Bank (untuk Finance)</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-bold">Status Pajak</label>
                    <select
                      value={taxable ? "pkp" : "nonpkp"}
                      onChange={(e) => setTaxable(e.target.value === "pkp")}
                      className={inputCls + " px-3"}
                    >
                      <option value="nonpkp">Non-PKP</option>
                      <option value="pkp">PKP</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-bold">NPWP</label>
                    <input value={npwp} onChange={(e) => setNpwp(e.target.value)} className={inputCls} placeholder="00.000.000.0-000.000" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-bold">Nama Bank</label>
                    <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputCls} placeholder="mis. BCA" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-bold">No. Rekening</label>
                    <input value={bankNo} onChange={(e) => setBankNo(e.target.value)} className={inputCls} placeholder="1234567890" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold">Atas Nama</label>
                  <input value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} className={inputCls} placeholder="Nama pemilik rekening" />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm font-semibold">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-eerie" />
                Aktif
              </label>

              {error && <p className="text-sm font-semibold text-danger">{error}</p>}

              {confirmDelete ? (
                <div className="rounded-xl border border-danger/40 bg-danger/5 p-3">
                  <p className="text-sm font-semibold text-danger">Yakin hapus supplier &quot;{name}&quot;?</p>
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
