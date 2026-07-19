import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getExpenseCategories, getAccounts } from "@/lib/finance";
import { getUserName, getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { ExpenseView, type ExpenseRow, type BrandOpt, type AccountOpt } from "./expense-view";

async function getData(): Promise<{ rows: ExpenseRow[]; brands: BrandOpt[]; accounts: AccountOpt[]; categories: string[] }> {
  if (!isSupabaseConfigured()) return { rows: [], brands: [], accounts: [], categories: [] };
  const supabase = createClient();
  const [expRes, brandRes, accs, categories] = await Promise.all([
    supabase.from("expenses").select("id,category,expense_date,amount,requester,payee,vendor_bank,vendor_account_no,vendor_account_holder,brand_id,notes,status").is("deleted_at", null).order("expense_date", { ascending: false }),
    supabase.from("brands").select("id,name").is("deleted_at", null).order("name"),
    getAccounts(supabase),
    getExpenseCategories(supabase),
  ]);
  const brands = (brandRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "Umum";
  const rows: ExpenseRow[] = (expRes.data ?? []).map((e) => ({
    id: e.id as string, category: e.category as string, date: (e.expense_date as string | null) ?? null,
    amount: Number(e.amount) || 0, payee: (e.payee as string | null) ?? "", brand: brandName((e.brand_id as string | null) ?? null),
    requester: (e.requester as string | null) ?? "",
    vendorBank: (e.vendor_bank as string | null) ?? "", vendorAccountNo: (e.vendor_account_no as string | null) ?? "", vendorAccountHolder: (e.vendor_account_holder as string | null) ?? "",
    brandId: (e.brand_id as string | null) ?? null, notes: (e.notes as string | null) ?? null, status: (e.status as string) ?? "unpaid",
  }));
  return { rows, brands, accounts: accs.map((a) => ({ id: a.id, name: a.name, balance: a.balance })), categories };
}

export default async function ExpensesPage() {
  const { rows, brands, accounts, categories } = await getData();
  let userName = "", canEdit = true;
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    userName = await getUserName(supabase);
    canEdit = canAct(await getRole(supabase), "fin_other");
  }
  return (
    <div className="mx-auto max-w-7xl">
      <ExpenseView rows={rows} categories={categories} brands={brands} accounts={accounts} userName={userName} canEdit={canEdit} />
    </div>
  );
}
