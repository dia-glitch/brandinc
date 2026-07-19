import { redirect } from "next/navigation";

// Kategori Biaya kini digantikan oleh Chart of Accounts (Accounting → Bagan Akun).
export default function ExpenseCategoriesPage() {
  redirect("/accounting/coa");
}
