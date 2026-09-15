import { Floor, roomFloorMap } from "../model/types";
import { Store, StoreReviewStatus, storeRoomNames } from "@/entities/store";

/**
 * 指定されたフロアかつ承認済みの店舗のみを返す
 * @param stores
 * @param floor
 * @returns
 */
export function selectApprovedStoresByFloor(
  stores: Store[],
  floor: Floor,
): Store[] {
  const targetRooms = new Set<string>(
    storeRoomNames.filter((room) => roomFloorMap[room] === floor),
  );
  return stores.filter(
    (store) =>
      store.reviewStatus === StoreReviewStatus.Approved &&
      targetRooms.has(store.room),
  );
}
