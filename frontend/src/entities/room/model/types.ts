import { v } from "@/shared/lib/valibot";

export const roomNames = [
  "1F",
  "501",
  "502",
  "503",
  "504",
  "505",
  "506",
  "507",
  "508",
  "509",
  "601",
  "602",
  "603",
  "604",
  "605",
  "606",
  "607",
  "608",
  "707",
  "iCrossArena",
  "8Fステージ",
] as const;

export const Room = v.object({
  name: v.picklist(roomNames),
});
export type Room = v.InferOutput<typeof Room>;
