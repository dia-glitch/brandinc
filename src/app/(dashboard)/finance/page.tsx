import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPayables, getAccounts } from "@/lib/finance";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { APTable, type Payable, type AccountOpt } from "./ap-table";

async function getData(): Promise<{ rows: Payable[]; accounts: AccountOpt[] }> {
  if (!isSupabaseConfigured()) return { rows: [], accounts: [] };
  const supabase = createClient();
  const [payables, accs] = await Promise.all([getPayables(supabase), getAccounts(supabase)]);
  return { rows: payables, accounts: accs.map((a) => ({ id: a.id, name: a.name, balance: a.balance })) };
}

export default async function FinanceAPPage() {
  const { rows, accounts } = await getData();
  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "fin_other");
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finance</p>
        <h1 className="text-2xl font-extrabold">Hutang / Accounts Payable</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Otomatis dari invoice bahan (PO) &amp; jasa produksi (GRN). Klik Bayar → pilih akun kas/bank (saldo berkurang).
        </p>
      </div>
      <APTable rows={rows} accounts={accounts} canEdit={canEdit} />
    </div>
  );
}
