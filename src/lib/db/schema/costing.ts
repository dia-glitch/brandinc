import { pgTable, uuid, numeric, boolean, unique } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";
import { workOrders } from "./production";

/**
 * Costing per SPK — menyimpan retail price (manual), status kunci, & % PPN.
 * COGM (material + WIP) / qty good dihitung on-the-fly dari data operasional.
 */
export const spkCosting = pgTable(
  "spk_costing",
  {
    ...baseColumns,
    spkId: uuid("spk_id").notNull().references(() => workOrders.id),
    retailPrice: numeric("retail_price", { precision: 18, scale: 4 }).notNull().default("0"),
    ppnPercent: numeric("ppn_percent", { precision: 6, scale: 2 }).notNull().default("11"),
    locked: boolean("locked").notNull().default(false),
  },
  (t) => ({ uq: unique("uq_spk_costing").on(t.spkId) })
);
