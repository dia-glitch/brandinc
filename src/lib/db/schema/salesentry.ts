import { pgTable, text, uuid, numeric, date } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";
import { salesChannels } from "./saleschannel";

/**
 * Entri Penjualan (manual) untuk P&L per brand — sampai modul Sales otomatis jadi.
 * Nominal general per periode/channel. Komponen: bruto, diskon, HPP (COGS),
 * komisi channel, estimasi PPN. Selalu terikat brand (brand_id) untuk P&L per brand;
 * konsolidasi group = jumlah semua brand.
 */
export const salesEntries = pgTable("sales_entries", {
  ...baseColumns,
  channelId: uuid("channel_id").references(() => salesChannels.id),
  period: text("period"),
  entryDate: date("entry_date"),
  gross: numeric("gross", { precision: 18, scale: 4 }).notNull().default("0"),
  discount: numeric("discount", { precision: 18, scale: 4 }).notNull().default("0"),
  hpp: numeric("hpp", { precision: 18, scale: 4 }).notNull().default("0"),
  commission: numeric("commission", { precision: 18, scale: 4 }).notNull().default("0"),
  ppn: numeric("ppn", { precision: 18, scale: 4 }).notNull().default("0"),
  notes: text("notes"),
});
