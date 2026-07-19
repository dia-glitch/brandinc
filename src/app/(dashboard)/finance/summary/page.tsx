import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPayables, getAccounts } from "@/lib/finance";
import { formatIDR } from "@/lib/utils";

type Row = { label: string; amount: number };

async function getData() {
  const empty = { apOutstanding: 0, apTotal: 0, cashTotal: 0, totalOut: 0, totalIn: 0, outRows: [] as Row[], inRows: [] as Row[] };
  if (!isSupabaseConfigured()) return empty;
  const supabase = createClient();
  const [payables, accs, payRes, prRes, expRes] = await Promise.all([
    getPayables(supabase),
    getAccounts(supabase),
    supabase.from("payments").select("direction,amount,ref_type,ref_key").is("deleted_at", null),
    supabase.from("payment_requests").select("code,type").is("deleted_at", null),
    supabase.from("expenses").select("id,category").is("deleted_at", null),
  ]);

  const apTotal = payables.reduce((s, p) => s + p.total, 0);
  const apOutstanding = payables.reduce((s, p) => s + Math.max(0, p.total - p.paid), 0);
  const cashTotal = accs.reduce((s, a) => s + a.balance, 0);

  const prType = new Map<string, string>((prRes.data ?? []).map((p) => [p.code as string, (p.type as string) ?? ""]));
  const expCat = new Map<string, string>((expRes.data ?? []).map((e) => [e.id as string, (e.category as string) ?? "Lainnya"]));

  const outMap = new Map<string, number>();
  const inMap = new Map<string, number>();
  const add = (map: Map<string, number>, label: string, amt: number) => map.set(label, (map.get(label) ?? 0) + amt);

  for (const p of payRes.data ?? []) {
    const amt = Number(p.amount) || 0;
    const rt = (p.ref_type as string | null) ?? "";
    const rk = (p.ref_key as string | null) ?? "";
    const dir = (p.direction as string) ?? "out";
    if (dir === "out") {
      if (rt === "transfer_out") continue; // pindah buku, bukan pengeluaran riil
      if (rt === "material_invoice") add(outMap, "Pembayaran Bahan (AP)", amt);
      else if (rt === "production_invoice") add(outMap, "Pembayaran Jasa Produksi (AP)", amt);
      else if (rt === "expense") add(outMap, `Expense · ${expCat.get(rk) ?? "Lainnya"}`, amt);
      else if (rt === "sales_refund") add(outMap, "Refund Retur Penjualan", amt);
      else if (rt === "payment_request") {
        const t = prType.get(rk) ?? "";
        add(outMap, t === "cash_advance" ? "Cash Advance" : t === "reimbursement" ? "Reimbursement" : t === "invoice" ? "Payment Request (Invoice)" : "Payment Request", amt);
      } else add(outMap, "Lainnya", amt);
    } else {
      if (rt === "transfer_in") continue;
      if (rt === "sales_income") add(inMap, "Penjualan Marketplace", amt);
      else if (rt === "sales_receipt") add(inMap, "Penerimaan Penjualan", amt);
      else if (rt === "ar_receipt") add(inMap, "Pelunasan Piutang (AR)", amt);
      else if (rt === "topup") add(inMap, "Setoran Modal", amt);
      else if (rt === "pr_refund") add(inMap, "Refund Cash Advance", amt);
      else add(inMap, "Pendapatan Lain", amt);
    }
  }

  const outRows = Array.from(outMap.entries()).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
  const inRows = Array.from(inMap.entries()).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
  const totalOut = outRows.reduce((s, r) => s + r.amount, 0);
  const totalIn = inRows.reduce((s, r) => s + r.amount, 0);

  return { apOutstanding, apTotal, cashTotal, totalOut, totalIn, outRows, inRows };
}

export default async function SummaryPage() {
  const d = await getData();
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finance</p>
        <h1 className="text-2xl font-extrabold">Ringkasan Keuangan</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">Rekap kas masuk &amp; keluar riil (yang sudah dibayarkan), hutang, &amp; saldo kas. Pindah buku antar akun tidak dihitung.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Kas Keluar" value={d.totalOut} tone="text-danger" sub="semua pembayaran riil" />
        <Stat label="Total Kas Masuk" value={d.totalIn} tone="text-emerald-700" sub="penerimaan riil" />
        <Stat label="Hutang Outstanding" value={d.apOutstanding} tone="text-danger" sub={`dari total ${formatIDR(d.apTotal)}`} />
        <Stat label="Saldo Kas & Bank" value={d.cashTotal} tone="text-foreground" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Breakdown title="Pengeluaran Riil per Jenis" rows={d.outRows} total={d.totalOut} totalLabel="Total Kas Keluar" empty="Belum ada pembayaran keluar." />
        <Breakdown title="Penerimaan per Sumber" rows={d.inRows} total={d.totalIn} totalLabel="Total Kas Masuk" empty="Belum ada penerimaan." />
      </div>
    </div>
  );
}

function Breakdown({ title, rows, total, totalLabel, empty }: { title: string; rows: Row[]; total: number; totalLabel: string; empty: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm font-medium text-muted-foreground">{empty}</div>
      ) : (
        <div className="card p-0">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground"><th className="px-5 py-3">Jenis</th><th className="px-5 py-3 text-right">Total</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-border font-semibold hover:bg-muted/40"><td className="px-5 py-3">{r.label}</td><td className="px-5 py-3 text-right tabular-nums">{formatIDR(r.amount)}</td></tr>
              ))}
              <tr className="border-t-2 border-border bg-muted/40 font-extrabold"><td className="px-5 py-3">{totalLabel}</td><td className="px-5 py-3 text-right tabular-nums">{formatIDR(total)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: number; tone?: string; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${tone ?? ""}`}>{formatIDR(value)}</p>
      {sub && <p className="mt-0.5 text-xs font-medium text-muted-foreground">{sub}</p>}
    </div>
  );
}
