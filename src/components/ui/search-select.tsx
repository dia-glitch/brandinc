"use client";

import { useState, useMemo, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchOption = { value: string; label: string; hint?: string };

/**
 * Dropdown yang bisa diketik untuk mencari (combobox).
 * Panel dirender dengan posisi fixed agar tidak terpotong container overflow.
 */
export function SearchSelect({
  value, onChange, options, placeholder = "Cari…", className, inputClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SearchOption[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s) || (o.hint ?? "").toLowerCase().includes(s));
  }, [q, options]);

  function openPanel() {
    const el = inputRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 240) });
    }
    setOpen(true);
    setQ("");
  }

  function pick(v: string) { onChange(v); setOpen(false); }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        value={open ? q : (selected?.label ?? "")}
        onFocus={openPanel}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQ(e.target.value)}
        placeholder={selected ? selected.label : placeholder}
        className={cn("h-9 w-full rounded-lg border border-border bg-background px-2 pr-7 text-sm font-semibold outline-none focus:border-primary/40", inputClassName)}
      />
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

      {open && rect && (
        <div
          style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width, zIndex: 80 }}
          className="max-h-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-soft"
        >
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick("")}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted">
            — Kosongkan —
          </button>
          {filtered.length === 0 ? (
            <p className="px-2.5 py-2 text-sm text-muted-foreground">Tidak ada hasil.</p>
          ) : filtered.map((o) => (
            <button key={o.value} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o.value)}
              className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold hover:bg-muted", o.value === value && "bg-muted")}>
              <span>{o.label}{o.hint ? <span className="ml-1.5 text-xs font-medium text-muted-foreground">{o.hint}</span> : null}</span>
              {o.value === value && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
