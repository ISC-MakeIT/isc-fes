import { redirect } from "next/navigation";
import { pageQuery, type PageSearchParams } from "@/lib/navigation";
export default async function Page({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const query = pageQuery(await searchParams);
  redirect(`/guests${query.size ? `?${query}` : ""}`);
}
