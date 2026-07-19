"use client";

import { Bell, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function Topbar() {
  const router = useRouter();

  async function handleLogout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // abaikan bila Supabase belum dikonfigurasi
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-6 py-3.5 backdrop-blur">
      <div className="ml-auto flex items-center gap-2.5">
        <span className="rounded-full bg-vanila px-3.5 py-2 text-xs font-extrabold tracking-wide text-eerie">
          ● DATA DEMO
        </span>
        <button className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground">
          <Bell className="h-[18px] w-[18px]" />
        </button>
        <button
          onClick={handleLogout}
          title="Keluar"
          className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-foreground hover:bg-muted"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
