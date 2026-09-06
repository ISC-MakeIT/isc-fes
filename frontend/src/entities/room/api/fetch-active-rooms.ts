import { activeRoomsKey, getStatusMessage } from "@/shared/config";
import { queryOptions } from "@tanstack/react-query";
import { createApiClient } from "@/shared/api";
import { v } from "@/shared/lib/valibot";
import { Room } from "../model/types";

export async function fetchActiveRooms() {
  // TODO: バックエンドのAPI叩いて有効な教室を返す
  const client = await createApiClient();
  const { data, error, response } = await client.GET("/rooms");

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(
    v.array(Room),
    data.data.map((room) => room.name),
  );
}

export function activeRoomsQueryOptions() {
  return queryOptions({
    queryKey: activeRoomsKey(),
    queryFn: fetchActiveRooms,
    staleTime: Infinity,
  });
}
