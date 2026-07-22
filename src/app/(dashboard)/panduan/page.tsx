import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import type { Role } from "@/lib/permissions";
import { PanduanView } from "./panduan-view";

export default async function PanduanPage() {
  let role: Role = "admin";
  if (isSupabaseConfigured()) role = await getRole(createClient());
  return <PanduanView role={role} />;
}
