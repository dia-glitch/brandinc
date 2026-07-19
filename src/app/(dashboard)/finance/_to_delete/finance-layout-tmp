import { FinanceTabs } from "./tabs";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canView, type PageKey } from "@/lib/permissions";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  let allow: PageKey[] = ["fin_other", "fin_payment_request"];
  if (isSupabaseConfigured()) {
    const role = await getRole(createClient());
    allow = (["fin_other", "fin_payment_request"] as PageKey[]).filter((k) => canView(role, k));
  }
  return (
    <>
      <FinanceTabs allow={allow} />
      {children}
    </>
  );
}
