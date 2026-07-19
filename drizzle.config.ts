import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Kita kelola RLS & function lewat SQL manual di supabase/policies & supabase/functions.
  verbose: true,
  strict: true,
});
