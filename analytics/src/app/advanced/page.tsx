import Dashboard from "@/components/dashboard";
import { redirect } from "next/navigation";
import { legacyAnalysisHref, pageQuery, type PageSearchParams } from "@/lib/navigation";
export default async function Page({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const legacy = legacyAnalysisHref(pageQuery(await searchParams));
  if (legacy && !legacy.startsWith("/advanced?")) redirect(legacy);
  return <Dashboard />;
}
