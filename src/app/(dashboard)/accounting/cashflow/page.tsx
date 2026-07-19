import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAccounts } from "@/lib/finance";
import { AP_COA_LABEL, coaCategory } from "@/lib/coa";
import { formatIDR } from "@/lib/utils";

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${names[Number(mo) - 1] ?? mo} ${y}`;
}

// Urutan kas masuk & keluar (label mengikuti kategori/COA yang sama dengan P&L).
const IN_ORDER = ["Penerimaan Penjualan", "Penjualan Marketplace", "Pelunasan Piutang (AR)", "Setoran Modal", "Refund Cash Advance", "Pendapatan Lain"];
function inRank(label: string) { const i = IN_ORDER.indexOf(label); return i < 0 ? 90 : i; }
function outRank(label: string) {
  if (label === "Bahan Baku Terpakai") return 0;
  if (label === "Ongkos Produksi (WIP)") return 1;
  if (label === "Refund Retur Penjualan") return 90;
  if (label === "Beban Operasional Lain") return 98;
  if (label === "Lainnya") return 99;
  return 50; // beban operasional per kategori (alfabet)
}

async function getData() {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const [payRes, expRes, prRes, accs] = await Promise.all([
    supabase.from("payments").select("pay_date,created_at,direction,amount,ref_type,ref_key").is("deleted_at", null),
    supabase.from("expenses").select("id,category").is("deleted_at", null),
    supabase.from("payment_requests").select("code,category").is("deleted_at", null),
    getAccounts(supabase),
  ]);
  const opening = accs.reduce((s, a) => s + a.opening, 0);
  const expCat = new Map((expRes.data ?? []).map((e) => [e.id as string, (e.category as string) ?? "Lainnya"]));
  const prCat = new Map((prRes.data ?? []).map((p) => [p.code as string, (p.category as string) ?? "Lainnya"]));

  const monthsSet = new Set<string>();
  const cell = new Map<string, Map<string, number>>(); // `${dir}|${label}` → month→amt
  const add = (dir: string, label: string, month: string, amt: number) => {
    monthsSet.add(month);
    const k = `${dir}|${label}`;
    if (!cell.has(k)) cell.set(k, new Map());
    const m = cell.get(k)!; m.set(month, (m.get(month) ?? 0) + amt);
  };

  const inLabel = (rt: string): string => ({
    sales_receipt: "Penerimaan Penjualan", sales_income: "Penjualan Marketplace", ar_receipt: "Pelunasan Piutang (AR)",
    topup: "Setoran Modal", pr_refund: "Refund Cash Advance", other_income: "Pendapatan Lain",
  } as Record<string, string>)[rt] ?? "Pendapatan Lain";
  const outLabel = (rt: string, rk: string): string => {
    if (rt === "material_invoice" || rt === "production_invoice") return AP_COA_LABEL[rt];
    if (rt === "sales_refund") return "Refund Retur Penjualan";
    if (rt === "expense") return coaCategory(expCat.get(rk));
    if (rt === "payment_request") return coaCategory(prCat.get(rk));
    return "Beban Operasional Lain";
  };

  for (const p of payRes.data ?? []) {
    const rt = (p.ref_type as string | null) ?? "";
    if (rt === "transfer_in" || rt === "transfer_out") continue;
    const dstr = (p.pay_date as string | null) ?? (typeof p.created_at === "string" ? p.created_at.slice(0, 10) : null);
    if (!dstr) continue;
    const month = dstr.slice(0, 7);
    const amt = Number(p.amount) || 0;
    if ((p.direction as string) === "in") add("in", inLabel(rt), month, amt);
    else add("out", outLabel(rt, (p.ref_key as string | null) ?? ""), month, amt);
  }

  const months = Array.from(monthsSet).sort();
  const val = (dir: string, label: string, month: string) => cell.get(`${dir}|${label}`)?.get(month) ?? 0;
  const rowTotal = (dir: string, label: string) => months.reduce((s, m) => s + val(dir, label, m), 0);
  const labelsOf = (dir: string) => Array.from(new Set(Array.from(cell.keys()).filter((k) => k.startsWith(dir + "|")).map((k) => k.slice(dir.length + 1))));
  const inCats = labelsOf("in").sort((a, b) => inRank(a) - inRank(b) || a.localeCompare(b));
  const outCats = labelsOf("out").sort((a, b) => outRank(a) - outRank(b) || a.localeCompare(b));
  const totIn = (m: string) => inCats.reduce((s, c) => s + val("in", c, m), 0);
  const totOut = (m: string) => outCats.reduce((s, c) => s + val("out", c, m), 0);
  const net = (m: string) => totIn(m) - totOut(m);

  const saldoAkhir: Record<string, number> = {};
  const saldoAwal: Record<string, number> = {};
  let run = opening;
  for (const m of months) { saldoAwal[m] = run; run += net(m); saldoAkhir[m] = run; }

  return { months, inCats, outCats, val, rowTotal, totIn, totOut, net, saldoAwal, saldoAkhir };
}

export default async function CashflowPage() {
  const d = await getData();
  return (
    <div className="mx-auto max-w-full space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Accounting</p>
        <h1 className="text-2xl font-extrabold">Arus Kas (Cash Flow)</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">Per bulan (memanjang ke samping). Kategori mengikuti COA/P&amp;L; Bahan &amp; Jasa Produksi terpisah. Pindah buku tidak dihitung.</p>
      </div>

      {!d || d.months.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada mutasi kas.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="sticky left-0 z-10 bg-surface py-2.5 pl-4 pr-3 text-left">Keterangan</th>
                {d.months.map((m) => <th key={m} className="py-2.5 px-3 text-right">{monthLabel(m)}</th>)}
                <th className="py-2.5 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <SectionRow label="ARUS KAS MASUK" span={d.months.length + 2} />
              {d.inCats.map((c) => (
                <tr key={`in-${c}`} className="border-t border-border/60">
                  <td className="sticky left-0 z-10 bg-surface py-2 pl-8 pr-3 font-semibold">{c}</td>
                  {d.months.map((m) => <td key={m} className="py-2 px-3 text-right tabular-nums">{fmt(d.val("in", c, m))}</td>)}
                  <td className="py-2 px-4 text-right tabular-nums font-bold">{fmt(d.rowTotal("in", c))}</td>
                </tr>
              ))}
              <TotalRow label="Total Kas Masuk" months={d.months} fn={d.totIn} tone="text-emerald-700" />

              <SectionRow label="ARUS KAS KELUAR" span={d.months.length + 2} />
              {d.outCats.map((c) => (
                <tr key={`out-${c}`} className="border-t border-border/60">
                  <td className="sticky left-0 z-10 bg-surface py-2 pl-8 pr-3 font-semibold">{c}</td>
                  {d.months.map((m) => <td key={m} className="py-2 px-3 text-right tabular-nums">{fmt(d.val("out", c, m))}</td>)}
                  <td className="py-2 px-4 text-right tabular-nums font-bold">{fmt(d.rowTotal("out", c))}</td>
                </tr>
              ))}
              <TotalRow label="Total Kas Keluar" months={d.months} fn={d.totOut} tone="text-danger" />

              <tr className="border-t-2 border-foreground/60 bg-muted/40 font-black">
                <td className="sticky left-0 z-10 bg-muted/40 py-2.5 pl-4 pr-3">ARUS KAS BERSIH</td>
                {d.months.map((m) => <td key={m} className={`py-2.5 px-3 text-right tabular-nums ${d.net(m) < 0 ? "text-danger" : "text-emerald-700"}`}>{fmt(d.net(m))}</td>)}
                <td className="py-2.5 px-4 text-right tabular-nums">{fmt(d.months.reduce((s, m) => s + d.net(m), 0))}</td>
              </tr>
              <tr className="border-t border-border text-muted-foreground">
                <td className="sticky left-0 z-10 bg-surface py-2 pl-4 pr-3 font-semibold">Saldo Awal</td>
                {d.months.map((m) => <td key={m} className="py-2 px-3 text-right tabular-nums">{fmt(d.saldoAwal[m])}</td>)}
                <td className="py-2 px-4"></td>
              </tr>
              <tr className="border-t border-border font-extrabold">
                <td className="sticky left-0 z-10 bg-surface py-2.5 pl-4 pr-3">Saldo Akhir Kas</td>
                {d.months.map((m) => <td key={m} className="py-2.5 px-3 text-right tabular-nums">{fmt(d.saldoAkhir[m])}</td>)}
                <td className="py-2.5 px-4 text-right tabular-nums">{fmt(d.saldoAkhir[d.months[d.months.length - 1]])}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs font-medium text-muted-foreground">Mockup — kategori beban keluar mengikuti kategori P&amp;L (mis. Marketing, Gaji &amp; Upah); Bahan &amp; Jasa Produksi baris tersendiri. Nilai 0 = “—”.</p>
    </div>
  );
}

function fmt(n: number) { return n === 0 ? "—" : formatIDR(n); }

function SectionRow({ label, span }: { label: string; span: number }) {
  return <tr className="bg-muted/40"><td className="sticky left-0 z-10 bg-muted/40 py-2 pl-4 pr-3 text-xs font-black uppercase tracking-wide text-muted-foreground" colSpan={span}>{label}</td></tr>;
}
function TotalRow({ label, months, fn, tone }: { label: string; months: string[]; fn: (m: string) => number; tone: string }) {
  return (
    <tr className="border-t border-border bg-muted/20 font-extrabold">
      <td className="sticky left-0 z-10 bg-muted/20 py-2 pl-4 pr-3">{label}</td>
      {months.map((m) => <td key={m} className={`py-2 px-3 text-right tabular-nums ${tone}`}>{fmt(fn(m))}</td>)}
      <td className={`py-2 px-4 text-right tabular-nums ${tone}`}>{fmt(months.reduce((s, m) => s + fn(m), 0))}</td>
    </tr>
  );
}
