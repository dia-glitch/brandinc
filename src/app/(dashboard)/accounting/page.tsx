import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getBalanceSheet, type BalanceSheet } from "@/lib/accounting";
import { formatIDR } from "@/lib/utils";

async function getData(): Promise<BalanceSheet | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  return getBalanceSheet(supabase);
}

export default async function AccountingPage() {
  const d = await getData();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Accounting</p>
          <h1 className="text-2xl font-extrabold">Neraca (Balance Sheet)</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Posisi keuangan per {today}. Diturunkan dari data operasional riil (kas, piutang, persediaan, hutang, modal).</p>
        </div>
        {d && (
          <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold ${d.balanced ? "bg-emerald-100 text-emerald-700" : "bg-danger/10 text-danger"}`}>
            {d.balanced ? "Seimbang ✓" : "Tidak seimbang"}
          </span>
        )}
      </div>

      {!d ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Data belum tersedia.</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ASET */}
          <div className="card p-0">
            <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-black uppercase tracking-wide">Aset</h2></div>
            <table className="w-full text-sm">
              <tbody>
                <SectionHead label="Aset Lancar" />
                <Line label="Kas & Bank" value={d.cash} />
                <Line label="Piutang Usaha (AR)" value={d.ar} />
                <Line label="Persediaan Bahan Baku" value={d.rawInventory} />
                <Line label="Persediaan Barang Jadi" value={d.fgInventory} />
                <Subtotal label="Total Aset Lancar" value={d.totalCurrentAssets} />
                <Total label="TOTAL ASET" value={d.totalAssets} />
              </tbody>
            </table>
          </div>

          {/* LIABILITAS + EKUITAS */}
          <div className="card p-0">
            <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-black uppercase tracking-wide">Liabilitas &amp; Ekuitas</h2></div>
            <table className="w-full text-sm">
              <tbody>
                <SectionHead label="Liabilitas Jangka Pendek" />
                <Line label="Utang Usaha (AP)" value={d.ap} />
                <Line label="Utang Operasional (Payment Request)" value={d.opsPayable} />
                <Subtotal label="Total Liabilitas" value={d.totalLiabilities} />
                <SectionHead label="Ekuitas" />
                <Line label="Modal Disetor" value={d.capital} />
                <Line label="Laba Ditahan (akumulasi)" value={d.retained} />
                <Subtotal label="Total Ekuitas" value={d.totalEquity} />
                <Total label="TOTAL LIABILITAS & EKUITAS" value={d.totalLiabilities + d.totalEquity} />
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card bg-muted/30 p-4 text-xs font-medium text-muted-foreground">
        <p className="mb-1 font-bold text-foreground">Catatan penyusunan</p>
        Neraca mengikuti identitas <b>Aset = Liabilitas + Ekuitas</b>. Persediaan bahan baku dinilai moving average; barang jadi = Good@COGM + Damage@WIP.
        Laba Ditahan dihitung sebagai akumulasi (Total Aset − Total Liabilitas − Modal Disetor) sehingga neraca selalu seimbang. Saat modul Sales &amp; jurnal manual lengkap, laba ditahan akan terurai per Laba Rugi.
      </div>
    </div>
  );
}

function SectionHead({ label }: { label: string }) {
  return <tr className="bg-muted/40"><td className="px-5 py-2 text-xs font-black uppercase tracking-wide text-muted-foreground" colSpan={2}>{label}</td></tr>;
}
function Line({ label, value }: { label: string; value: number }) {
  return <tr className="border-t border-border/60"><td className="px-5 py-2.5 font-semibold">{label}</td><td className="px-5 py-2.5 text-right tabular-nums">{formatIDR(value)}</td></tr>;
}
function Subtotal({ label, value }: { label: string; value: number }) {
  return <tr className="border-t border-border bg-muted/20 font-extrabold"><td className="px-5 py-2.5">{label}</td><td className="px-5 py-2.5 text-right tabular-nums">{formatIDR(value)}</td></tr>;
}
function Total({ label, value }: { label: string; value: number }) {
  return <tr className="border-t-2 border-foreground/70 text-base font-black"><td className="px-5 py-3">{label}</td><td className="px-5 py-3 text-right tabular-nums">{formatIDR(value)}</td></tr>;
}
