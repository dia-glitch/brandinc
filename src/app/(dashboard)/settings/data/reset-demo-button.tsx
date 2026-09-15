"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, CheckCircle2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetDemoData, resetForGoLive } from "./actions";

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

/** Go-Live: hapus transaksi + SELURUH master data demo. Konfirmasi ketik "HAPUS". */
export function GoLiveResetButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function run() {
    setErr(null); setMsg(null);
    start(async () => {
      const res = await resetForGoLive();
      if (res.ok) { setMsg("Data demo (transaksi + master) dihapus. Siap mulai bersih dengan data asli. Brand, gudang, akun kas & COA tetap."); setOpen(false); setWord(""); router.refresh(); }
      else setErr(res.error);
    });
  }

  if (msg) return <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {msg}</p>;

  return (
    <div className="mt-4">
      {open ? (
        <div className="space-y-2.5">
          <p className="text-sm font-bold text-danger">
            Menghapus SEMUA data demo — transaksi + master (materials, produk, SKU, supplier, kategori/warna/ukuran).
            Tidak bisa dibatalkan. Ketik <b>HAPUS</b> untuk konfirmasi.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="Ketik HAPUS"
              className="h-9 w-40 rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-danger/50"
            />
            <Button variant="danger" size="sm" disabled={pending || word.trim().toUpperCase() !== "HAPUS"} onClick={run}>
              {pending ? "Menghapus…" : "Ya, mulai bersih"}
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => { setOpen(false); setWord(""); }}>Batal</Button>
          </div>
        </div>
      ) : (
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}><Rocket className="h-4 w-4" /> Mulai Bersih (Go-Live)</Button>
      )}
      {err && <p className="mt-2 text-sm font-semibold text-danger">{err}</p>}
    </div>
  );
}
