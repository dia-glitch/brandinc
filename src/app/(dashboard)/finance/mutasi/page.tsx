import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAccounts } from "@/lib/finance";
import { MutasiView, type Mutation, type AccountOpt } from "./mutasi-view";

async function getData(): Promise<{ mutations: Mutation[]; accounts: AccountOpt[] }> {
  if (!isSupabaseConfigured()) return { mutations: [], accounts: [] };
  const supabase = createClient();
  const [accs, payRes, expRes] = await Promise.all([
    getAccounts(supabase),
    supabase.from("payments").select("id,account_id,pay_date,direction,amount,method,ref_type,ref_key,notes,created_at").is("deleted_at", null).order("pay_date", { ascending: false }).limit(1000),
    supabase.from("expenses").select("id,category,payee").is("deleted_at", null),
  ]);

  const accById = new Map((accs ?? []).map((a) => [a.id, a]));
  const accName = (id: string | null) => (id ? accById.get(id)?.name ?? "—" : "—");
  const expById = new Map((expRes.data ?? []).map((e) => [e.id as string, { category: (e.category as string) ?? "", payee: (e.payee as string | null) ?? "" }]));

  const desc = (refType: string | null, refKey: string | null, direction: string, notes: string | null): string => {
    switch (refType) {
      case "transfer_in": return "Pindah buku (masuk)";
      case "transfer_out": return "Pindah buku (keluar)";
      case "topup": return notes || "Setoran modal / top-up";
      case "sales_income": return `Penjualan Marketplace${refKey ? " · " + refKey : ""}`;
      case "ar_receipt": return `Pelunasan piutang (AR)${refKey ? " · " + refKey : ""}`;
      case "sales_receipt": return `Penerimaan penjualan${refKey ? " · " + refKey : ""}`;
      case "other_income": return notes || "Pendapatan lain";
      case "material_invoice": return "Bayar invoice bahan";
      case "production_invoice": return "Bayar invoice jasa produksi";
      case "payment_request": return "Bayar Payment Request";
      case "pr_refund": return notes || "Refund cash advance";
      case "sales_refund": return `Refund retur penjualan${refKey ? " · " + refKey : ""}`;
      case "expense": {
        const e = refKey ? expById.get(refKey) : undefined;
        return e ? `Bayar expense · ${e.category}${e.payee ? " · " + e.payee : ""}` : "Bayar expense";
      }
      default: return notes || (direction === "in" ? "Pemasukan" : "Pengeluaran");
    }
  };
  // Referensi yang ditampilkan (no invoice / PR / kode transfer). Untuk expense, ref_key = id internal → sembunyikan.
  const refShown = (refType: string | null, refKey: string | null): string => {
    if (!refKey) return "—";
    if (refType === "expense" || refType === "topup" || refType === "sales_income" || refType === "other_income") return "—";
    return refKey;
  };

  const mutations: Mutation[] = (payRes.data ?? []).map((p) => {
    const refType = (p.ref_type as string | null) ?? null;
    const refKey = (p.ref_key as string | null) ?? null;
    const direction = (p.direction as string) ?? "out";
    return {
      id: p.id as string, accountId: (p.account_id as string | null) ?? null, account: accName((p.account_id as string | null) ?? null),
      date: (p.pay_date as string | null) ?? null, direction, amount: Number(p.amount) || 0,
      method: (p.method as string | null) ?? null, refType, ref: refShown(refType, refKey),
      desc: desc(refType, refKey, direction, (p.notes as string | null) ?? null),
      isTransfer: refType === "transfer_in" || refType === "transfer_out",
      createdAt: (p.created_at as string | null) ?? null,
    };
  });

  const accounts: AccountOpt[] = (accs ?? []).map((a) => ({ id: a.id, name: a.name, opening: a.opening }));
  return { mutations, accounts };
}

export default async function MutasiPage() {
  const { mutations, accounts } = await getData();
  return (
    <div className="mx-auto max-w-7xl">
      <MutasiView mutations={mutations} accounts={accounts} />
    </div>
  );
}
