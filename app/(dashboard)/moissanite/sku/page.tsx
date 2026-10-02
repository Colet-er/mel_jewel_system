import { redirect } from "next/navigation";

export default function MoissaniteSkuPage() {
  redirect("/products?tab=moissanite");
}
