"use client";

import { useState } from "react";
import { ChevronRight, CornerDownRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CategoryDialog, type CategoryData } from "./category-dialog";

type ParentOpt = { id: string; name: string };

export function CategoryTree({
  categories,
  parents,
  canEdit = true,
}: {
  categories: CategoryData[];
  parents: ParentOpt[];
  canEdit?: boolean;
}) {
  const tops = categories.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);
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
        <button type="button" onClick={() => setExpanded(new Set(tops.map((t) => t.id)))} className="hover:text-foreground">
          Perluas semua
        </button>
        <span>·</span>
        <button type="button" onClick={() => setExpanded(new Set())} className="hover:text-foreground">
          Tutup semua
        </button>
      </div>

      {tops.map((top) => {
        const kids = childrenOf(top.id);
        const isOpen = expanded.has(top.id);
        return (
          <div key={top.id} className="card overflow-hidden p-0">
            <div className="flex items-center gap-3 p-4">
              <button
                type="button"
                onClick={() => toggle(top.id)}
                className="flex flex-1 items-center gap-3 text-left"
              >
                <ChevronRight
                  className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")}
                />
                <span className="text-base font-extrabold">{top.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{top.code}</span>
                {kids.length > 0 && <Badge tone="neutral">{kids.length} sub</Badge>}
                {!top.is_active && <Badge tone="neutral">Nonaktif</Badge>}
              </button>
              <div className="flex items-center gap-1">
                <CategoryDialog label="Sub-kategori" defaultParentId={top.id} parents={parents} canEdit={canEdit} />
                <CategoryDialog category={top} parents={parents} canEdit={canEdit} />
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-border">
                {kids.length === 0 ? (
                  <div className="px-11 py-3 text-sm font-medium text-muted-foreground">Belum ada sub-kategori.</div>
                ) : (
                  kids.map((ch) => (
                    <div
                      key={ch.id}
                      className="flex items-center gap-3 border-b border-border/60 py-3 pl-11 pr-4 last:border-b-0"
                    >
                      <CornerDownRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-semibold">{ch.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{ch.code}</span>
                      {!ch.is_active && <Badge tone="neutral">Nonaktif</Badge>}
                      <div className="ml-auto">
                        <CategoryDialog category={ch} parents={parents} canEdit={canEdit} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
