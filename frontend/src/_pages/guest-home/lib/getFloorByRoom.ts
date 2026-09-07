import { Room } from "@/entities/room";
import { Floor, roomFloorMap } from "../model/types";
import { roomNames } from "@/entities/room/model/types";

export function getRoomsByFloor(floor: Floor): Room[] {
  return roomNames.filter((room) => roomFloorMap[room] === floor);
}
