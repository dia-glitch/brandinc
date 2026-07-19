import { uuid, timestamp, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Kolom standar yang WAJIB ada di setiap tabel bisnis (lihat blueprint Bab 4.1):
 * - multi-tenant: company_id, brand_id  (isolasi via RLS)
 * - audit: created_at/by, updated_at/by
 * - soft delete: deleted_at (data bisnis tidak pernah hard-delete)
 * - is_demo: penanda data sample agar bisa dihapus bersih (Bab 12)
 *
 * Spread ke setiap pgTable: `...baseColumns`.
 */
export const baseColumns = {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: uuid("company_id").notNull(),
  brandId: uuid("brand_id"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};
