import { MasterDataTabs } from "./tabs";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canView } from "@/lib/permissions";

export default async function MasterDataLayout({ children }: { children: React.ReactNode }) {
  // Tab admin (Brand/Gudang/Akun Penjualan) hanya tampil untuk yang boleh lihat master_data (admin).
  let showAdmin = true;
  if (isSupabaseConfigured()) showAdmin = canView(await getRole(createClient()), "master_data");
  return (
    <>
      <MasterDataTabs showAdmin={showAdmin} />
      {children}
    </>
  );
}
