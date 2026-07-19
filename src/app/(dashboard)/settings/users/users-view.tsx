"use client";

import { useState, useTransition } from "react";
import { Check, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_OPTIONS, ROLE_LABEL, type Role } from "@/lib/permissions";
import { updateUserRole } from "./actions";

export type UserRow = { id: string; email: string | null; name: string | null; role: string };

export function UsersView({ rows, meId }: { rows: UserRow[]; meId: string | null }) {
  return (
    <div className="card p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <th className="px-5 py-3">Pengguna</th>
            <th className="px-5 py-3">Role saat ini</th>
            <th className="px-5 py-3">Ubah role</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => <Row key={u.id} u={u} isMe={u.id === meId} />)}
        </tbody>
      </table>
    </div>
  );
}

function Row({ u, isMe }: { u: UserRow; isMe: boolean }) {
  const [role, setRole] = useState<Role>((u.role as Role) ?? "staff");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = role !== u.role;

  function save() {
    setErr(null); setSaved(false);
    start(async () => {
      const res = await updateUserRole(u.id, role);
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
      else { setErr(res.error ?? "Gagal menyimpan."); setRole((u.role as Role) ?? "staff"); }
    });
  }

  return (
    <tr className="border-t border-border/60 align-middle">
      <td className="px-5 py-3">
        <div className="font-bold">{u.name || u.email || "—"}</div>
        <div className="text-xs font-medium text-muted-foreground">{u.email ?? u.id.slice(0, 8)}{isMe && " · Anda"}</div>
      </td>
      <td className="px-5 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-bold">
          <Shield className="h-3 w-3" /> {ROLE_LABEL[(u.role as Role)] ?? u.role}
        </span>
      </td>
      <td className="px-5 py-3">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          disabled={pending}
          className="h-9 w-full max-w-[220px] rounded-lg border border-border bg-surface px-2.5 text-sm font-semibold outline-none focus:border-primary/40"
        >
          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {err && <p className="mt-1 text-xs font-semibold text-danger">{err}</p>}
      </td>
      <td className="px-5 py-3 text-right">
        {saved ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Check className="h-4 w-4" /> Tersimpan</span>
        ) : (
          <Button size="sm" onClick={save} disabled={!dirty || pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
        )}
      </td>
    </tr>
  );
}
