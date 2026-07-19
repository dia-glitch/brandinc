import { redirect } from "next/navigation";

// Alur PO bahan baku kini menyatu di Raw Material → tab Purchase Order.
export default function PurchasingRedirect() {
  redirect("/raw-material/po");
}
