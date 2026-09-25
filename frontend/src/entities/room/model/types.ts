import { v } from "@/shared/lib/valibot";

export const roomNames = [
  "1F",
  "501教室",
  "502教室",
  "503教室",
  "504教室",
  "505教室",
  "506教室",
  "507教室",
  "508教室",
  "509教室",
  "601教室",
  "602教室",
  "603教室",
  "604教室",
  "605教室",
  "606教室",
  "607教室",
  "608教室",
  "707教室",
  "iCrossArena",
  "8Fステージ",
] as const;

export const Room = v.picklist(roomNames, "有効な教室を入力してください");

export type Room = v.InferOutput<typeof Room>;
