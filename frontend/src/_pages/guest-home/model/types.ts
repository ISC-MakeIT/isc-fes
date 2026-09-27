import { Room } from "@/entities/room";

export type Floor = 1 | 5 | 6 | 7 | 8;

export const roomFloorMap = {
  "1F": 1,
  "501教室": 5,
  "502教室": 5,
  "503教室": 5,
  "504教室": 5,
  "505教室": 5,
  "506教室": 5,
  "507教室": 5,
  "508教室": 5,
  "509教室": 5,
  "601教室": 6,
  "602教室": 6,
  "603教室": 6,
  "604教室": 6,
  "605教室": 6,
  "606教室": 6,
  "607教室": 6,
  "608教室": 6,
  "707教室": 7,
  iCrossArena: 7,
  "8Fステージ": 8,
} as const satisfies Record<Room, Floor>;
