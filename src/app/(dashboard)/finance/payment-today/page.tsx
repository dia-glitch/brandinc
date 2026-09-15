import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getFinanceDesk } from "@/lib/finance-desk";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { PaymentTodayView, type PTAccount } from "./payment-today-view";

export default async function PaymentTodayPage() {
  if (!isSupabaseConfigured()) return <PaymentTodayView items={[]} accounts={[]} canEdit={false} />;
  const supabase = createClient();
  const [{ items, accounts }, role] = await Promise.all([getFinanceDesk(supabase), getRole(supabase)]);
  const marked = items.filter((i) => i.marked);
  const accs: PTAccount[] = accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, balance: a.balance }));
  const canEdit = canAct(role, "fin_other");
  return <PaymentTodayView items={marked} accounts={accs} canEdit={canEdit} />;
}
