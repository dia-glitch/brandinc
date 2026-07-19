import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import type { Role } from "@/lib/permissions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let role: Role = "admin";

  // Penjaga akses: kalau Supabase sudah dikonfigurasi, wajib login.
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Pastikan baris profil ada (untuk manajemen role di Settings › Pengguna).
    try {
      const { data: prof } = await supabase.from("user_profiles").select("id").eq("id", user.id).maybeSingle();
      if (!prof) {
        const { count } = await supabase.from("user_profiles").select("id", { count: "exact", head: true });
        await supabase.from("user_profiles").insert({
          id: user.id,
          email: user.email ?? null,
          name: (user.user_metadata?.name as string | undefined) ?? null,
          role: (count ?? 0) === 0 ? "admin" : "staff",
        });
      }
    } catch {
      // tabel belum siap → abaikan, jangan blokir
    }

    role = await getRole(supabase);
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-x-hidden px-6 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
