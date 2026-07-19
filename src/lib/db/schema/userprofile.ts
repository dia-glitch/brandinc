import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Profil & peran pengguna (menyatu dgn Supabase auth.users via id).
 * role: admin | staff. Admin boleh edit/adjustment data terposting.
 * Bootstrap: bila belum ada profil sama sekali, user login pertama dianggap admin.
 */
export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id
  email: text("email"),
  name: text("name"),
  role: text("role").notNull().default("staff"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
