import { readSnapshot } from "@/server/db";
import { loadGuestAnalytics } from "@/server/guest-queries";
import { parseGuestFilters } from "@/lib/report-filters";
import { errorResponse, noStore } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const filters = parseGuestFilters(new URL(request.url).searchParams);
    return Response.json(await readSnapshot((client) => loadGuestAnalytics(client, filters)), {
      headers: noStore,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
