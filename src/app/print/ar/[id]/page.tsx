import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatIDR } from "@/lib/utils";
import { PrintButton } from "./print-button";

export default async function ARPrintPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ar } = await supabase
    .from("receivables")
    .select("id,code,channel_id,brand_id,pay_account_id,bill_to,period,invoice_date,due_date,amount,notes,company_id")
    .eq("id", params.id).is("deleted_at", null).single();
  if (!ar) notFound();

  const [chanRes, brandRes, acctRes, payRes, coRes] = await Promise.all([
    ar.channel_id ? supabase.from("sales_channels").select("name").eq("id", ar.channel_id).single() : Promise.resolve({ data: null }),
    ar.brand_id ? supabase.from("brands").select("name").eq("id", ar.brand_id).single() : Promise.resolve({ data: null }),
    ar.pay_account_id ? supabase.from("cash_accounts").select("name,bank_name,account_no,account_holder").eq("id", ar.pay_account_id).single() : Promise.resolve({ data: null }),
    supabase.from("payments").select("amount").eq("ref_type", "ar_receipt").eq("ref_key", ar.code).eq("direction", "in").is("deleted_at", null),
    supabase.from("companies").select("legal_name").eq("id", ar.company_id).single(),
  ]);

  const company = coRes.data?.legal_name ?? "Brand.Inc";
  const brand = (brandRes.data as { name?: string } | null)?.name ?? null;
  const acct = acctRes.data as { name?: string; bank_name?: string; account_no?: string; account_holder?: string } | null;
  const store = (ar.bill_to as string | null) || (chanRes.data as { name?: string } | null)?.name || "—";
  const amount = Number(ar.amount) || 0;
  const paid = (payRes.data ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const outstanding = Math.max(0, amount - paid);

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-eerie">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black">{company}</h1>
          <p className="text-sm text-muted-foreground">Invoice Penagihan · Piutang (AR)</p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-end justify-between border-t border-b border-border py-4">
        <div>
          <p className="text-2xl font-black tracking-tight">{ar.code as string}</p>
          <p className="text-sm text-muted-foreground">Tanggal: {(ar.invoice_date as string) ?? "—"}</p>
        </div>
        <div className="text-right text-sm">
          {brand && <p className="font-bold">Brand: {brand}</p>}
          {ar.period && <p className="text-muted-foreground">Periode: {ar.period as string}</p>}
          <p className="text-muted-foreground">Jatuh tempo: {(ar.due_date as string) ?? "—"}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-wide text-muted-foreground">Ditagihkan kepada</p>
          <p className="font-bold">{store}</p>
          <p className="text-sm text-muted-foreground">Store konsinyasi</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-wide text-muted-foreground">Penagih</p>
          <p className="font-bold">{company}</p>
          <p className="text-sm text-muted-foreground">Divisi Finance</p>
        </div>
      </div>

      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-border/60">
            <td className="py-2 font-semibold">Penagihan penjualan konsinyasi{ar.period ? ` · ${ar.period as string}` : ""}</td>
            <td className="py-2 text-right tabular-nums">{formatIDR(amount)}</td>
          </tr>
          <tr className="text-muted-foreground">
            <td className="py-1.5 font-semibold">Sudah diterima</td>
            <td className="py-1.5 text-right tabular-nums">{formatIDR(paid)}</td>
          </tr>
          <tr className="text-base font-black">
            <td className="py-2.5">SISA TAGIHAN</td>
            <td className="py-2.5 text-right tabular-nums">{formatIDR(outstanding)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-6 rounded-xl border border-border p-4">
        <p className="mb-1 text-xs font-black uppercase tracking-wide text-muted-foreground">Pembayaran ke Rekening</p>
        {acct ? (
          <p className="text-sm font-semibold">{acct.bank_name ?? acct.name} · {acct.account_no ?? "—"} · a.n. {acct.account_holder || company}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Rekening tujuan belum dipilih.</p>
        )}
      </div>

      {ar.notes && <p className="mt-4 text-sm text-muted-foreground">Catatan: {ar.notes as string}</p>}

      <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
        <div>
          <p className="mb-12 text-muted-foreground">Hormat kami,</p>
          <p className="border-t border-border pt-1 font-semibold">{company}</p>
        </div>
        <div>
          <p className="mb-12 text-muted-foreground">Diterima & disetujui,</p>
          <p className="border-t border-border pt-1 font-semibold">{store}</p>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Tagihan ini adalah penagihan total penerimaan penjualan konsinyasi (nominal general, tanpa rincian produk).
      </p>
    </div>
  );
}
