import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { COA_TYPE_LABEL, COA_TYPE_ORDER } from "@/lib/coa";
import { CoaDialog, type CoaData } from "./coa-dialog";
import { SeedButton } from "./seed-button";

async function getData(): Promise<CoaData[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data } = await supabase.from("chart_of_accounts").select("id,code,name,type").is("deleted_at", null).order("code");
  return (data ?? []) as CoaData[];
}

export default async function CoaPage() {
  const accounts = await getData();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Accounting</p>
          <h1 className="text-2xl font-extrabold">Bagan Akun (Chart of Accounts)</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{accounts.length} akun. Fondasi untuk jurnal &amp; laporan. Bisa ditambah/edit sendiri.</p>
        </div>
        <div className="flex items-center gap-2"><SeedButton /><CoaDialog /></div>
      </div>

      {accounts.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada akun</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Klik &quot;Isi COA Bawaan&quot; untuk memuat bagan akun standar (Aset, Liabilitas, Ekuitas, Pendapatan, HPP, Beban, dll).</p>
        </div>
      ) : (
        <div className="space-y-6">
          {COA_TYPE_ORDER.map((type) => {
            const rows = accounts.filter((a) => a.type === type);
            if (rows.length === 0) return null;
            return (
              <div key={type}>
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{COA_TYPE_LABEL[type] ?? type}</p>
                <div className="card p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      {rows.map((a) => (
                        <tr key={a.id} className="border-t border-border first:border-t-0 font-semibold hover:bg-muted/50">
                          <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground w-20">{a.code}</td>
                          <td className="px-5 py-2.5">{a.name}</td>
                          <td className="px-5 py-2.5 text-right"><CoaDialog account={a} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
