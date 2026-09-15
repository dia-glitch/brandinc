"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X, ScanLine } from "lucide-react";

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect: (src: CanvasImageSource) => Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
function getBD(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

/** Tombol scan: buka kamera HP (BarcodeDetector) atau scanner USB / input manual. */
export function ScanButton({ onScan, label = "Scan Barcode", className }: { onScan: (code: string) => void; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={className ?? "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-eerie px-4 text-sm font-bold text-white hover:opacity-90 sm:w-auto"}>
        <ScanLine className="h-4 w-4" /> {label}
      </button>
      {open && <ScannerModal onClose={() => setOpen(false)} onScan={onScan} />}
    </>
  );
}

function ScannerModal({ onClose, onScan }: { onClose: () => void; onScan: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [last, setLast] = useState<string | null>(null);

  useEffect(() => {
    const Ctor = getBD();
    setSupported(!!Ctor);
    if (!Ctor) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let lastVal = "", lastAt = 0;
    const detector = new Ctor({ formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code", "itf"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      } catch { setErr("Tidak bisa akses kamera. Izinkan kamera, atau pakai scanner USB / ketik manual."); return; }
      const loop = async () => {
        if (stopped || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const v = codes?.[0]?.rawValue;
          if (v) {
            const now = Date.now();
            if (v !== lastVal || now - lastAt > 1500) { lastVal = v; lastAt = now; setLast(v); onScan(v); }
          }
        } catch { /* frame not ready */ }
        timer = setTimeout(loop, 350);
      };
      loop();
    })();
    return () => { stopped = true; if (timer) clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-eerie/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-surface p-4 shadow-soft" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold"><Camera className="h-4 w-4" /> Scan Barcode</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        {supported ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" />
          </div>
        ) : (
          <p className="rounded-xl bg-muted p-3 text-sm font-medium">Kamera scan tidak didukung di browser ini. Gunakan scanner USB/Bluetooth atau ketik kode di bawah lalu Enter.</p>
        )}
        {err && <p className="mt-2 text-sm font-semibold text-danger">{err}</p>}
        {last && <p className="mt-2 text-sm font-bold text-emerald-600">Terbaca: {last}</p>}
        <form onSubmit={(e) => { e.preventDefault(); const v = manual.trim(); if (v) { onScan(v); setLast(v); setManual(""); } }} className="mt-3 flex gap-2">
          <input autoFocus value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Ketik / scan USB → Enter" className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40" />
          <button type="submit" className="rounded-xl bg-eerie px-4 text-sm font-bold text-white">Tambah</button>
        </form>
        <button onClick={onClose} className="mt-2 w-full rounded-xl border border-border py-2 text-sm font-bold hover:bg-muted">Selesai</button>
      </div>
    </div>
  );
}
