export type PageSearchParams = Record<string, string | string[] | undefined>;
export function pageQuery(params: PageSearchParams): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((v) => query.append(key, v));
    else if (value !== undefined) query.set(key, value);
  }
  return query;
}
export function legacyAnalysisHref(params: URLSearchParams): string | null {
  const destinations: Record<string, string> = {
    overview: "/overview",
    sales: "/stores",
    orders: "/stores",
    congestion: "/advanced",
    explorer: "/advanced",
  };
  const view = params.get("view");
  const destination = view && Object.hasOwn(destinations, view) ? destinations[view] : null;
  if (!destination) return null;
  const query = new URLSearchParams(params);
  if (destination !== "/advanced") query.delete("view");
  return `${destination}${query.size ? `?${query}` : ""}`;
}
