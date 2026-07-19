import { Construction } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ComingSoon({ module, phase }: { module: string; phase: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-24 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-vanila text-eerie">
        <Construction className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold">{module}</h1>
      <p className="mt-2 text-sm font-medium text-muted-foreground">
        Modul ini menyusul pada fase pengembangan berikutnya. Fondasi database &amp; dua engine
        (Inventory Ledger + Accounting) sudah menopangnya sejak awal.
      </p>
      <Badge tone="info" className="mt-4">{phase}</Badge>
    </div>
  );
}
