import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatIDR } from "@/lib/utils";
import { PrintButton } from "./print-button";

export default async function MIPrintPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: mi } = await supabase
    .from("material_issues").select("id,code,spk_id,company_id,warehouse_id,issue_date,status,notes").eq("id", params.id).is("deleted_at", null).single();
  if (!mi) notFound();

  const [lineRes, spkRes, whRes, coRes] = await Promise.all([
    supabase.from("material_issue_lines").select("material_name,unit,qty,unit_cost").eq("issue_id", mi.id).is("deleted_at", null),
    supabase.from("work_orders").select("code").eq("id", mi.spk_id).maybeSingle(),
    supabase.from("warehouses").select("name").eq("id", mi.warehouse_id).maybeSingle(),
    supabase.from("companies").select("legal_name").eq("id", mi.company_id).single(),
  ]);

  const lines = lineRes.data ?? [];
  const spkCode = (spkRes.data as { code?: string } | null)?.code ?? "—";
  const whName = (whRes.data as { name?: string } | null)?.name ?? "—";
  const company = coRes.data?.legal_name ?? "Brand.Inc";
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0);

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-eerie">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black">{company}</h1>
          <p className="text-sm text-muted-foreground">Bukti Pengeluaran Bahan (Material Issue)</p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-end justify-between border-t border-b border-border py-4">
        <div>
          <p className="text-2xl font-black tracking-tight">{mi.code}</p>
          <p className="text-sm text-muted-foreground">Status: {mi.status === "cancelled" ? "DIBATALKAN" : "KELUAR"}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-bold">Untuk SPK: <span className="font-mono">{spkCode}</span></p>
          <p className="text-muted-foreground">Gudang: {whName}</p>
          <p className="text-muted-foreground">Tgl: {(mi.issue_date as string) ?? "—"}</p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-bold uppercase text-muted-foreground">
            <th className="py-2">Material</th><th className="py-2">Satuan</th>
            <th className="py-2 text-right">Qty</th><th className="py-2 text-right">Avg Cost</th><th className="py-2 text-right">Nilai</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-border/60">
              <td className="py-1.5 font-semibold">{l.material_name as string}</td>
              <td className="py-1.5">{(l.unit as string) ?? "—"}</td>
              <td className="py-1.5 text-right tabular-nums">{Number(l.qty) || 0}</td>
              <td className="py-1.5 text-right tabular-nums">{formatIDR(Number(l.unit_cost) || 0)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatIDR((Number(l.qty) || 0) * (Number(l.unit_cost) || 0))}</td>
            </tr>
          ))}
          <tr className="font-black"><td className="py-2.5" colSpan={4}>TOTAL NILAI KELUAR</td><td className="py-2.5 text-right tabular-nums">{formatIDR(total)}</td></tr>
        </tbody>
      </table>

      {(mi.notes as string) && (
        <div className="mt-4"><p className="mb-1 text-xs font-black uppercase tracking-wide text-muted-foreground">Catatan</p><p className="whitespace-pre-line text-sm">{mi.notes as string}</p></div>
      )}

      <div className="mt-10 grid grid-cols-3 gap-6 text-sm">
        <Sign label="Diminta (Produksi)" /><Sign label="Dikeluarkan (Gudang)" /><Sign label="Diterima (Vendor)" />
      </div>
    </div>
  );
}

function Sign({ label }: { label: string }) {
  return (<div><p className="mb-12 text-muted-foreground">{label},</p><p className="border-t border-border pt-1 font-semibold">&nbsp;</p></div>);
}
