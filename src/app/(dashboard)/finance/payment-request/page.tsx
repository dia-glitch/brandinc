import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getExpenseCategories, getAccounts } from "@/lib/finance";
import { getRole, getUserName } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { PRView, type PRRow, type BrandOpt, type AccountOpt } from "./pr-view";
import type { Attachment } from "./actions";

async function getData(): Promise<{ rows: PRRow[]; brands: BrandOpt[]; accounts: AccountOpt[]; categories: string[] }> {
  if (!isSupabaseConfigured()) return { rows: [], brands: [], accounts: [], categories: [] };
  const supabase = createClient();
  const [prRes, brandRes, cpRes, accs, categories] = await Promise.all([
    supabase.from("payment_requests")
      .select("id,code,type,title,requester,payee,vendor_bank,vendor_account_no,vendor_account_holder,category,brand_id,amount,status,scheduled_date,settled_amount,notes,attachments")
      .is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("brands").select("id,name").is("deleted_at", null).order("name"),
    supabase.from("cash_purchases").select("pr_id,total").is("deleted_at", null),
    getAccounts(supabase),
    getExpenseCategories(supabase),
  ]);
  const brands = (brandRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "Umum";
  // Realisasi dari pembelian tunai (Raw Material) yang mengacu ke cash advance ini.
  const realizedByPr = new Map<string, number>();
  const purchaseCountByPr = new Map<string, number>();
  for (const cp of cpRes.data ?? []) {
    const pr = (cp.pr_id as string | null) ?? "";
    if (!pr) continue;
    realizedByPr.set(pr, (realizedByPr.get(pr) ?? 0) + (Number(cp.total) || 0));
    purchaseCountByPr.set(pr, (purchaseCountByPr.get(pr) ?? 0) + 1);
  }
  const rows: PRRow[] = (prRes.data ?? []).map((r) => ({
    id: r.id as string, code: r.code as string, type: (r.type as string) ?? "invoice",
    title: (r.title as string | null) ?? "", payee: (r.payee as string | null) ?? "",
    requester: (r.requester as string | null) ?? "",
    vendorBank: (r.vendor_bank as string | null) ?? "", vendorAccountNo: (r.vendor_account_no as string | null) ?? "", vendorAccountHolder: (r.vendor_account_holder as string | null) ?? "",
    category: (r.category as string | null) ?? "", brand: brandName((r.brand_id as string | null) ?? null),
    brandId: (r.brand_id as string | null) ?? null, amount: Number(r.amount) || 0,
    status: (r.status as string) ?? "draft", scheduledDate: (r.scheduled_date as string | null) ?? null,
    settledAmount: r.settled_amount != null ? Number(r.settled_amount) : null,
    notes: (r.notes as string | null) ?? "",
    attachments: Array.isArray(r.attachments) ? (r.attachments as Attachment[]) : [],
    purchasedAmount: realizedByPr.get(r.id as string) ?? 0,
    purchaseCount: purchaseCountByPr.get(r.id as string) ?? 0,
  }));
  return { rows, brands, accounts: accs.map((a) => ({ id: a.id, name: a.name, balance: a.balance })), categories };
}

export default async function PaymentRequestPage() {
  const { rows, brands, accounts, categories } = await getData();
  let canManage = true, canSubmit = true, userName = "";
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const role = await getRole(supabase);
    canManage = role === "finance" || role === "admin";
    canSubmit = canAct(role, "fin_payment_request");
    userName = await getUserName(supabase);
  }
  return (
    <div className="mx-auto max-w-7xl">
      <PRView rows={rows} brands={brands} accounts={accounts} categories={categories} canManage={canManage} canSubmit={canSubmit} userName={userName} />
    </div>
  );
}
