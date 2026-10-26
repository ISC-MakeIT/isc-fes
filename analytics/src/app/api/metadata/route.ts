import { readSnapshot } from "@/server/db";
import { loadMetadata } from "@/server/queries";
import { errorResponse, noStore } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await readSnapshot(loadMetadata), { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}
