import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAccounts } from "@/lib/finance";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { CashView, type Account } from "./cash-view";

async function getData(): Promise<{ accounts: Account[] }> {
  if (!isSupabaseConfigured()) return { accounts: [] };
  const supabase = createClient();
  const accs = await getAccounts(supabase);
  return { accounts: accs };
}

export default async function CashPage() {
  const { accounts } = await getData();
  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "fin_other");
  return (
    <div className="mx-auto max-w-7xl">
      <CashView accounts={accounts} canEdit={canEdit} />
    </div>
  );
}
