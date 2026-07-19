import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Badge } from "@/components/ui/badge";
import { SupplierDialog, type SupplierData } from "./supplier-dialog";
import { CategoryManager, type SupplierCategory } from "./category-manager";

async function getData(): Promise<{ suppliers: SupplierData[]; categories: SupplierCategory[] }> {
  if (!isSupabaseConfigured()) return { suppliers: [], categories: [] };
  const supabase = createClient();
  const [sup, cat] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id,code,name,category_id,phone,email,is_taxable,npwp,bank_name,bank_account_no,bank_account_name,is_active")
      .is("deleted_at", null)
      .order("name"),
    supabase.from("supplier_categories").select("id,name").is("deleted_at", null).order("name"),
  ]);
  return {
    suppliers: (sup.data ?? []) as SupplierData[],
    categories: (cat.data ?? []) as SupplierCategory[],
  };
}

export default async function SuppliersPage() {
  const { suppliers, categories } = await getData();
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Master Data</p>
          <h1 className="text-2xl font-extrabold">Supplier</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{suppliers.length} supplier terdaftar.</p>
        </div>
        <div className="flex gap-2.5">
          <CategoryManager categories={categories} />
          <SupplierDialog categories={categories} />
        </div>
      </div>

      {suppliers.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada supplier</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Pastikan tabel <code>suppliers</code> &amp; <code>supplier_categories</code> sudah disiapkan, lalu klik &quot;Supplier Baru&quot;.
          </p>
        </div>
      ) : (
        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Kode</th>
                  <th className="px-5 py-3">Nama</th>
                  <th className="px-5 py-3">Kategori</th>
                  <th className="px-5 py-3">Pajak</th>
                  <th className="px-5 py-3">Telepon</th>
                  <th className="px-5 py-3">Bank</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-t border-border font-semibold hover:bg-muted/50">
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{s.code}</td>
                    <td className="px-5 py-3">{s.name}</td>
                    <td className="px-5 py-3 font-medium text-muted-foreground">{catName(s.category_id)}</td>
                    <td className="px-5 py-3">
                      {s.is_taxable ? <Badge tone="info">PKP</Badge> : <Badge tone="neutral">Non-PKP</Badge>}
                    </td>
                    <td className="px-5 py-3 font-medium text-muted-foreground">{s.phone ?? "—"}</td>
                    <td className="px-5 py-3 font-medium text-muted-foreground">
                      {s.bank_name ? (
                        <span>
                          {s.bank_name} <span className="font-mono text-xs">{s.bank_account_no ?? ""}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {s.is_active ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <SupplierDialog supplier={s} categories={categories} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs font-medium text-muted-foreground">
        Data pajak (PKP/NPWP) &amp; rekening bank tersimpan agar langsung bisa dipakai modul Finance nanti.
      </p>
    </div>
  );
}
