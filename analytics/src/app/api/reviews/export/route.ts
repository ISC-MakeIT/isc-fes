import { readSnapshot } from "@/server/db";
import { loadReviewComments } from "@/server/review-queries";
import { parseReviewFilters, reviewCommentCSV } from "@/lib/reviews";
import { makeCSV } from "@/lib/csv";
import { errorResponse, noStore } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const filters = parseReviewFilters(new URL(request.url).searchParams);
    const rows = await readSnapshot((client) => loadReviewComments(client, filters));
    return new Response(makeCSV(reviewCommentCSV(rows)), {
      headers: {
        ...noStore,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="isc-fes-reviews.csv"',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
