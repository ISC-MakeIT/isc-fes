import { parseOverviewFilters } from "@/lib/overview";
import { readSnapshot } from "@/server/db";
import { errorResponse, noStore } from "@/server/http";
import { loadOverview } from "@/server/overview-queries";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const filters = parseOverviewFilters(new URL(request.url).searchParams);
    return Response.json(await readSnapshot((client) => loadOverview(client, filters)), {
      headers: noStore,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
