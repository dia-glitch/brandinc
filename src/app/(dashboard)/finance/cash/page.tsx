import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAccounts } from "@/lib/finance";
import { CashView, type Account } from "./cash-view";

async function getData(): Promise<{ accounts: Account[] }> {
  if (!isSupabaseConfigured()) return { accounts: [] };
  const supabase = createClient();
  const accs = await getAccounts(supabase);
  return { accounts: accs };
}

export default async function CashPage() {
  const { accounts } = await getData();
  return (
    <div className="mx-auto max-w-7xl">
      <CashView accounts={accounts} />
    </div>
  );
}
