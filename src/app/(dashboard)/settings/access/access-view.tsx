"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { saveMatrix } from "./actions";
import type { Cell } from "./types";

type RoleOpt = { value: string; label: string };
type Group = { label: string; keys: { key: string; label: string }[] };
type Matrix = Record<string, Record<string, Cell>>;

const NEXT: Record<Cell, Cell> = { none: "L", L: "A", A: "none" };
const CELL_STYLE: Record<Cell, string> = {
  none: "bg-transparent text-muted-foreground/50 hover:bg-muted",
  L: "bg-muted text-foreground font-extrabold hover:brightness-95",
  A: "bg-primary text-primary-foreground font-extrabold hover:brightness-110",
};
const CELL_TEXT: Record<Cell, string> = { none: "·", L: "L", A: "A" };

export function AccessView({ roles, groups, initial }: { roles: RoleOpt[]; groups: Group[]; initial: Matrix }) {
  const router = useRouter();
  const [matrix, setMatrix] = useState<Matrix>(initial);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [pending, start] = useTransition();

  const allKeys = useMemo(() => groups.flatMap((g) => g.keys), [groups]);

  const dirty = useMemo(() => {
    for (const r of roles) for (const k of allKeys) {
      if ((matrix[r.value]?.[k.key] ?? "none") !== (initial[r.value]?.[k.key] ?? "none")) return true;
    }
    return false;
  }, [matrix, initial, roles, allKeys]);

  function cycle(role: string, key: string) {
    setStatus(null);
    setMatrix((m) => ({ ...m, [role]: { ...m[role], [key]: NEXT[m[role]?.[key] ?? "none"] } }));
  }

  function setRow(role: string, level: Cell) {
    setStatus(null);
    setMatrix((m) => {
      const row: Record<string, Cell> = {};
      for (const k of allKeys) row[k.key] = level;
      return { ...m, [role]: row };
    });
  }

  function onSave() {
    const rows: { role: string; page_key: string; level: Cell }[] = [];
    for (const r of roles) for (const k of allKeys) rows.push({ role: r.value, page_key: k.key, level: matrix[r.value]?.[k.key] ?? "none" });
    start(async () => {
      const res = await saveMatrix(rows);
      if (res.ok) {
        setStatus({ kind: "ok", msg: "Akses halaman tersimpan. Menu & pembatasan aksi mengikuti perubahan ini." });
        router.refresh();
      } else {
        setStatus({ kind: "err", msg: res.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5"><Cellbox c="A" /> Aksi (lihat + ubah)</span>
          <span className="flex items-center gap-1.5"><Cellbox c="L" /> Lihat saja</span>
          <span className="flex items-center gap-1.5"><Cellbox c="none" /> Tanpa akses</span>
          <span className="text-muted-foreground/70">— klik sel untuk mengganti.</span>
        </div>
        <div className="flex items-center gap-3">
          {status && (
            <span className={status.kind === "ok" ? "text-xs font-semibold text-emerald-600" : "text-xs font-semibold text-danger"}>
              {status.msg}
            </span>
          )}
          <Button size="sm" onClick={onSave} disabled={!dirty || pending}>
            {pending ? "Menyimpan…" : "Simpan Akses Halaman"}
          </Button>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-surface px-4 py-2 text-left text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                Role
              </th>
              {groups.map((g) => (
                <th key={g.label} colSpan={g.keys.length} className="border-l border-border px-3 py-2 text-center text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </th>
              ))}
              <th className="border-l border-border px-3 py-2" />
            </tr>
            <tr className="border-b border-border bg-muted/40">
              <th className="sticky left-0 z-10 bg-surface px-4 py-2" />
              {groups.map((g) =>
                g.keys.map((k, i) => (
                  <th key={k.key} className={"px-2 py-2 text-center align-bottom text-[10px] font-bold text-muted-foreground " + (i === 0 ? "border-l border-border" : "")}>
                    <span className="block max-w-[68px] leading-tight">{k.label}</span>
                  </th>
                ))
              )}
              <th className="border-l border-border px-3 py-2 text-center text-[10px] font-bold text-muted-foreground">Semua</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.value} className="border-b border-border/60 last:border-0">
                <td className="sticky left-0 z-10 bg-surface px-4 py-2 font-bold text-foreground whitespace-nowrap">{r.label}</td>
                {groups.map((g) =>
                  g.keys.map((k, i) => {
                    const c = matrix[r.value]?.[k.key] ?? "none";
                    return (
                      <td key={k.key} className={i === 0 ? "border-l border-border p-1" : "p-1"}>
                        <button
                          type="button"
                          onClick={() => cycle(r.value, k.key)}
                          className={"h-8 w-full min-w-[34px] rounded-md text-xs transition " + CELL_STYLE[c]}
                          title={k.label + " — " + (c === "A" ? "Aksi" : c === "L" ? "Lihat saja" : "Tanpa akses")}
                        >
                          {CELL_TEXT[c]}
                        </button>
                      </td>
                    );
                  })
                )}
                <td className="border-l border-border px-2 py-1">
                  <div className="flex justify-center gap-1">
                    <button type="button" onClick={() => setRow(r.value, "none")} className="rounded px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground hover:bg-muted" title="Kosongkan baris">·</button>
                    <button type="button" onClick={() => setRow(r.value, "L")} className="rounded px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground hover:bg-muted" title="Set semua Lihat">L</button>
                    <button type="button" onClick={() => setRow(r.value, "A")} className="rounded px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground hover:bg-muted" title="Set semua Aksi">A</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs font-medium text-muted-foreground">
        Catatan: role <b>Admin</b> selalu punya akses penuh dan tidak bisa dibatasi. Menu <b>Settings</b> khusus Admin.
        Perubahan berlaku untuk semua pengguna dalam beberapa detik.
      </p>
    </div>
  );
}

function Cellbox({ c }: { c: Cell }) {
  return <span className={"inline-flex h-5 w-5 items-center justify-center rounded text-[11px] " + CELL_STYLE[c]}>{CELL_TEXT[c]}</span>;
}
