"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ColorDialog, type ColorData } from "./color-dialog";

type ParentOpt = { id: string; name: string };

function Swatch({ hex, size = "h-6 w-6" }: { hex: string | null; size?: string }) {
  return (
    <span
      className={cn("shrink-0 rounded-lg border border-border", size)}
      style={{ background: hex ?? "hsl(var(--muted))" }}
    />
  );
}

export function ColorTree({ colors, parents, canEdit = true }: { colors: ColorData[]; parents: ParentOpt[]; canEdit?: boolean }) {
  const tops = colors.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => colors.filter((c) => c.parent_id === id);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-3 text-xs font-bold text-muted-foreground">
        <button type="button" onClick={() => setExpanded(new Set(tops.map((t) => t.id)))} className="hover:text-foreground">Perluas semua</button>
        <span>·</span>
        <button type="button" onClick={() => setExpanded(new Set())} className="hover:text-foreground">Tutup semua</button>
      </div>

      {tops.map((top) => {
        const kids = childrenOf(top.id);
        const isOpen = expanded.has(top.id);
        return (
          <div key={top.id} className="card overflow-hidden p-0">
            <div className="flex items-center gap-3 p-4">
              <button type="button" onClick={() => toggle(top.id)} className="flex flex-1 items-center gap-3 text-left">
                <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                <Swatch hex={top.hex} />
                <span className="text-base font-extrabold">{top.name}</span>
                {kids.length > 0 && <Badge tone="neutral">{kids.length} warna</Badge>}
                {!top.is_active && <Badge tone="neutral">Nonaktif</Badge>}
              </button>
              <div className="flex items-center gap-1">
                <ColorDialog label="Sub Colour" defaultParentId={top.id} parents={parents} canEdit={canEdit} />
                <ColorDialog color={top} parents={parents} canEdit={canEdit} />
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-border">
                {kids.length === 0 ? (
                  <div className="px-12 py-3 text-sm font-medium text-muted-foreground">Belum ada sub colour.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                    {kids.map((ch) => (
                      <div key={ch.id} className="flex items-center gap-3 border-t border-border/60 py-2.5 pl-6 pr-3">
                        <Swatch hex={ch.hex} size="h-5 w-5" />
                        <span className="flex-1 truncate font-semibold">{ch.name}</span>
                        {!ch.is_active && <Badge tone="neutral">Off</Badge>}
                        <ColorDialog color={ch} parents={parents} canEdit={canEdit} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
