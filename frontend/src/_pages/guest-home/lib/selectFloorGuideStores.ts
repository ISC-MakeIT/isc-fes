import { Floor, roomFloorMap } from "../model/types";
import { roomNames } from "@/entities/room/model/types";
import { Store, StoreReviewStatus } from "@/entities/store";

/**
 * 指定されたフロアかつ承認済みの店舗のみを返す
 * @param stores
 * @param floor
 * @returns
 */
export function selectFloorGuideStores(stores: Store[], floor: Floor): Store[] {
  //   const targetRooms = roomNames.filter((room) => roomFloorMap[room] === floor);
  const targetRooms = new Set<string>(
    roomNames.filter((room) => roomFloorMap[room] == floor),
  );
  return stores.filter(
    (store) =>
      store.reviewStatus === StoreReviewStatus.Approved &&
      targetRooms.has(store.room),
  );
}
