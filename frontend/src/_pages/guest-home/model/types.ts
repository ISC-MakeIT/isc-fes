import { Room } from "@/entities/room";

export type Floor = 1 | 5 | 6 | 7 | 8;

export const roomFloorMap = {
  "1F": 1,
  "501": 5,
  "502": 5,
  "503": 5,
  "504": 5,
  "505": 5,
  "506": 5,
  "507": 5,
  "508": 5,
  "509": 5,
  "601": 6,
  "602": 6,
  "603": 6,
  "604": 6,
  "605": 6,
  "606": 6,
  "607": 6,
  "608": 6,
  "707": 7,
  iCrossArena: 7,
  "8Fステージ": 8,
} as const satisfies Record<Room, Floor>;
