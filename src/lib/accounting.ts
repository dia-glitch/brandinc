import type { createClient } from "@/lib/supabase/server";
import { getAccounts, getPayables } from "@/lib/finance";
import { getSkuCosting } from "@/lib/costing";

type SB = ReturnType<typeof createClient>;

export type BalanceLine = { label: string; amount: number };
export type BalanceSheet = {
  cash: number;
  ar: number;
  rawInventory: number;
  fgInventory: number;
  totalCurrentAssets: number;
  totalAssets: number;
  ap: number;
  opsPayable: number;
  totalLiabilities: number;
  capital: number;
  retained: number;
  totalEquity: number;
  balanced: boolean;
};

/**
 * Neraca (Balance Sheet) diturunkan dari data operasional riil.
 * Identitas akuntansi: Aset = Liabilitas + Ekuitas.
 * Ekuitas = Modal Disetor + Laba Ditahan (akumulasi), di mana
 * Laba Ditahan = Total Aset − Total Liabilitas − Modal Disetor (residu, membuat neraca seimbang).
 */
export async function getBalanceSheet(supabase: SB): Promise<BalanceSheet> {
  const [accs, payables, matBalRes, fgLineRes, arRes, arPayRes, capRes, prRes, skuCost] = await Promise.all([
    getAccounts(supabase),
    getPayables(supabase),
    supabase.from("material_stock_balances").select("qty_on_hand,moving_avg_cost").is("deleted_at", null),
    supabase.from("fg_receipt_lines").select("sku,qty_good,qty_damage,unit_cost").is("deleted_at", null),
    supabase.from("receivables").select("code,amount").is("deleted_at", null),
    supabase.from("payments").select("ref_key,amount").eq("ref_type", "ar_receipt").eq("direction", "in").is("deleted_at", null),
    supabase.from("payments").select("amount").eq("ref_type", "topup").eq("direction", "in").is("deleted_at", null),
    supabase.from("payment_requests").select("amount,status,type").is("deleted_at", null),
    getSkuCosting(supabase),
  ]);

  // Aset lancar
  const cash = accs.reduce((s, a) => s + a.balance, 0);

  const arPaidByCode = new Map<string, number>();
  (arPayRes.data ?? []).forEach((p) => { const k = (p.ref_key as string) ?? ""; if (k) arPaidByCode.set(k, (arPaidByCode.get(k) ?? 0) + (Number(p.amount) || 0)); });
  const ar = (arRes.data ?? []).reduce((s, r) => s + Math.max(0, (Number(r.amount) || 0) - (arPaidByCode.get(r.code as string) ?? 0)), 0);

  const rawInventory = (matBalRes.data ?? []).reduce((s, b) => s + (Number(b.qty_on_hand) || 0) * (Number(b.moving_avg_cost) || 0), 0);

  const fgInventory = (fgLineRes.data ?? []).reduce((s, l) => {
    const sku = (l.sku as string | null) ?? "";
    const cogm = skuCost.get(sku)?.cogm ?? (Number(l.unit_cost) || 0);
    const good = Number(l.qty_good) || 0;
    const damage = Number(l.qty_damage) || 0;
    // Good dinilai COGM penuh; Damage hanya WIP (unit_cost) — konsisten dgn Finished Goods.
    return s + good * cogm + damage * (Number(l.unit_cost) || 0);
  }, 0);

  const totalCurrentAssets = cash + ar + rawInventory + fgInventory;
  const totalAssets = totalCurrentAssets;

  // Liabilitas
  const ap = payables.reduce((s, p) => s + Math.max(0, p.total - p.paid), 0);
  const opsPayable = (prRes.data ?? []).filter((p) => ["approved", "scheduled"].includes((p.status as string) ?? "")).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalLiabilities = ap + opsPayable;

  // Ekuitas
  const capital = (capRes.data ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const retained = totalAssets - totalLiabilities - capital;
  const totalEquity = capital + retained;

  const balanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1;

  return { cash, ar, rawInventory, fgInventory, totalCurrentAssets, totalAssets, ap, opsPayable, totalLiabilities, capital, retained, totalEquity, balanced };
}
