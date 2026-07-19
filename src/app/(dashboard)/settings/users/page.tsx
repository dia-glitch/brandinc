import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { SettingsTabs } from "../tabs";
import { UsersView, type UserRow } from "./users-view";

async function getData(): Promise<{ rows: UserRow[]; meId: string | null } | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("user_profiles")
    .select("id,email,name,role,created_at")
    .order("created_at", { ascending: true });
  const rows: UserRow[] = (data ?? []).map((u) => ({
    id: u.id as string,
    email: (u.email as string | null) ?? null,
    name: (u.name as string | null) ?? null,
    role: (u.role as string | null) ?? "staff",
  }));
  return { rows, meId: user?.id ?? null };
}

export default async function UsersPage() {
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    if ((await getRole(supabase)) !== "admin") redirect("/");
  }
  const d = await getData();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SettingsTabs />
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Settings</p>
        <h1 className="text-2xl font-extrabold">Pengguna &amp; Role</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Tetapkan peran tiap pengguna. Akses menu &amp; aksi mengikuti matriks role (A = bisa aksi, L = lihat saja, kosong = tanpa akses).
        </p>
      </div>

      {!d ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Data belum tersedia.</div>
      ) : d.rows.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">
          Belum ada pengguna terdaftar. Setiap user yang login akan muncul di sini otomatis.
        </div>
      ) : (
        <UsersView rows={d.rows} meId={d.meId} />
      )}
    </div>
  );
}
