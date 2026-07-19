import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAccounts } from "@/lib/finance";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { RefundView, type RefundRow, type AccountOpt } from "./refund-view";

async function getData(): Promise<{ rows: RefundRow[]; accounts: AccountOpt[] }> {
  if (!isSupabaseConfigured()) return { rows: [], accounts: [] };
  const supabase = createClient();
  const [srRes, brandRes, accs] = await Promise.all([
    supabase.from("sales_returns").select("id,code,order_id,brand_id,return_date,refund_amount,refund_bank_name,refund_account_no,refund_account_holder,refund_status,refund_paid_at")
      .eq("refund_required", "1").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    getAccounts(supabase),
  ]);
  const brandName = (id: string | null) => (brandRes.data ?? []).find((b) => b.id === id)?.name ?? "—";
  const rows: RefundRow[] = (srRes.data ?? []).map((r) => ({
    id: r.id as string, code: r.code as string, brand: brandName((r.brand_id as string | null) ?? null),
    date: (r.return_date as string | null) ?? null, amount: Number(r.refund_amount) || 0,
    bankName: (r.refund_bank_name as string | null) ?? "", accountNo: (r.refund_account_no as string | null) ?? "", accountHolder: (r.refund_account_holder as string | null) ?? "",
    status: (r.refund_status as string) ?? "pending", paidAt: (r.refund_paid_at as string | null) ?? null,
  }));
  return { rows, accounts: accs.map((a) => ({ id: a.id, name: a.name, balance: a.balance })) };
}

export default async function RefundPage() {
  const { rows, accounts } = await getData();
  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "fin_other");
  return (
    <div className="mx-auto max-w-7xl">
      <RefundView rows={rows} accounts={accounts} canEdit={canEdit} />
    </div>
  );
}
