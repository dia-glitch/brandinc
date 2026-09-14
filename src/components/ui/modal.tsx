"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modal popup reusable (backdrop, klik-luar & ESC untuk tutup, scroll internal).
 * Header opsional (title/subtitle/badge) & footer opsional untuk tombol aksi.
 */
export function Modal({
  title, subtitle, badge, onClose, children, footer, size = "md",
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const max = size === "lg" ? "max-w-2xl" : size === "sm" ? "max-w-sm" : "max-w-md";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4" onClick={onClose}>
      <div
        className={cn("max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft", max)}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || badge || subtitle) && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {badge && <div className="mb-1">{badge}</div>}
              {title && <h2 className="text-lg font-extrabold leading-tight">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-sm font-medium text-muted-foreground">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>
        )}
        <div className="space-y-4">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">{footer}</div>}
      </div>
    </div>
  );
}

/** Baris field label→value untuk grid detail. */
export function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 break-words text-sm font-bold", mono && "font-mono")}>{children}</p>
    </div>
  );
}
