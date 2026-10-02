import { redirect } from "next/navigation";

export default function SoldMoissaniteRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect("/moissanite/sold");
}
