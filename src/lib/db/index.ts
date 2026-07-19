import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Koneksi Drizzle untuk keperluan SERVER-SIDE / migrasi / job admin.
 * CATATAN PENTING: koneksi ini memakai DATABASE_URL (role Postgres) yang BISA
 * melewati RLS. Untuk akses data atas nama user (menghormati RLS), gunakan
 * Supabase client (src/lib/supabase/*), BUKAN koneksi ini. Lihat blueprint Bab 8 (R1).
 */
const connectionString = process.env.DATABASE_URL;

const client = connectionString
  ? postgres(connectionString, { prepare: false })
  : undefined;

export const db = client ? drizzle(client, { schema }) : (undefined as never);
export { schema };
