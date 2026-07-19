"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { seedDefaultChannels } from "./actions";

export function SeedButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-sm font-semibold text-muted-foreground">{msg}</span>}
      <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => {
        const r = await seedDefaultChannels();
        setMsg(r.ok ? (r.added > 0 ? `${r.added} akun ditambahkan.` : "Semua akun bawaan sudah ada.") : r.error);
        router.refresh();
      })}>
        <Sparkles className="h-4 w-4" /> {pending ? "Mengisi…" : "Isi Bawaan"}
      </Button>
    </div>
  );
}
