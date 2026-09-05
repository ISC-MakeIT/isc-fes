import { activeRoomsKey } from "@/shared/config";
import { queryOptions } from "@tanstack/react-query";
import { rooms } from "../model/types";

function fetchActiveRooms() {
  // TODO: バックエンドのAPI叩いて有効な教室を返す
  return rooms;
}

export function activeRoomsQueryOptions() {
  return queryOptions({
    queryKey: activeRoomsKey(),
    queryFn: fetchActiveRooms,
    staleTime: Infinity,
  });
}
