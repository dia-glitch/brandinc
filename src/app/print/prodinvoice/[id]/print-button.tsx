"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-full bg-eerie px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
    >
      <Printer className="h-4 w-4" /> Print / Simpan PDF
    </button>
  );
}
