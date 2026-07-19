import { redirect } from "next/navigation";

// Material dipindah ke section Raw Material (sering ditambah).
export default function MaterialsRedirect() {
  redirect("/raw-material/materials");
}
