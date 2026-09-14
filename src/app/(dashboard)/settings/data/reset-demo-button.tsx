"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetDemoData } from "./actions";

export function ResetDemoButton() {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function run() {
    setErr(null); setMsg(null);
    start(async () => {
      const res = await resetDemoData();
      if (res.ok) { setMsg("Semua data transaksi demo berhasil direset. Master data, COA & akun kas tetap."); setConfirm(false); router.refresh(); }
      else setErr(res.error);
    });
  }

  if (msg) return <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {msg}</p>;

  return (
    <div className="mt-4">
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-bold text-danger">Yakin hapus semua transaksi demo?</span>
          <Button variant="danger" size="sm" disabled={pending} onClick={run}>{pending ? "Menghapus…" : "Ya, reset sekarang"}</Button>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirm(false)}>Batal</Button>
        </div>
      ) : (
        <Button variant="danger" size="sm" onClick={() => setConfirm(true)}><RotateCcw className="h-4 w-4" /> Reset Data Demo</Button>
      )}
      {err && <p className="mt-2 text-sm font-semibold text-danger">{err}</p>}
    </div>
  );
}
