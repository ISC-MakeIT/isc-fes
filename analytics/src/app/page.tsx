import { redirect } from "next/navigation";
import HomeReport from "@/components/reports/home-report";
import { legacyAnalysisHref, pageQuery, type PageSearchParams } from "@/lib/navigation";
export default async function Page({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const query = pageQuery(await searchParams);
  const legacy = legacyAnalysisHref(query);
  if (legacy) redirect(legacy);
  const period = new URLSearchParams();
  for (const key of ["start", "end", "interval"]) {
    const value = query.get(key);
    if (value) period.set(key, value);
  }
  return <HomeReport query={period.size ? `?${period}` : ""} />;
}
