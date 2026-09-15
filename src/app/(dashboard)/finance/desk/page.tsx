import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getFinanceDesk } from "@/lib/finance-desk";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { FinanceDeskView } from "./desk-view";

export default async function FinanceDeskPage() {
  if (!isSupabaseConfigured()) return <FinanceDeskView items={[]} canEdit={false} />;
  const supabase = createClient();
  const [{ items }, role] = await Promise.all([getFinanceDesk(supabase), getRole(supabase)]);
  const canEdit = canAct(role, "fin_other");
  return <FinanceDeskView items={items} canEdit={canEdit} />;
}
