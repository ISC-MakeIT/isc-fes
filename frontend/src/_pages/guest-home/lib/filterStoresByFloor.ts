import { Floor, roomFloorMap } from "../model/types";
import { roomNames } from "@/entities/room/model/types";
import { Store } from "@/entities/store";

export function filterStoresByFloor(stores: Store[], floor: Floor): Store[] {
  //   const targetRooms = roomNames.filter((room) => roomFloorMap[room] === floor);
  const targetRooms = new Set<string>(
    roomNames.filter((room) => roomFloorMap[room] == floor),
  );
  return stores.filter((store) => targetRooms.has(store.room));
}
