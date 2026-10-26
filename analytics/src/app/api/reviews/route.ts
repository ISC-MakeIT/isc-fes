import { readSnapshot } from "@/server/db";
import { loadReviewAnalytics } from "@/server/review-queries";
import { parseReviewFilters } from "@/lib/reviews";
import { errorResponse, noStore } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const filters = parseReviewFilters(new URL(request.url).searchParams);
    return Response.json(await readSnapshot((client) => loadReviewAnalytics(client, filters)), {
      headers: noStore,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
