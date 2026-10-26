import { readSnapshot } from "@/server/db";
import { loadAnalytics } from "@/server/queries";
import { parseFilters } from "@/lib/filters";
import { errorResponse, noStore } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const filters = parseFilters(new URL(request.url).searchParams);
    return Response.json(await readSnapshot((client) => loadAnalytics(client, filters)), {
      headers: noStore,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
