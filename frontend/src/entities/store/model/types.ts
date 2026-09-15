import { v } from "@/shared/lib/valibot";

export enum StoreReviewStatus {
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
}
const StoreReviewStatusSchema = v.enum(StoreReviewStatus);

export const StoreName = v.pipe(
  v.string(),
  v.minLength(1, "1文字以上で入力してください"),
  v.maxLength(100, "100文字以内で入力してください"),
);

export const StoreDescription = v.pipe(
  v.string(),
  v.minLength(1, "1文字以上で入力してください"),
  v.maxLength(1000, "1000文字以内で入力してください"),
);

const Allergen = v.object({
  id: v.string(),
  name: v.string(),
});

export const storeRoomNames = [
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
export const StoreRoom = v.picklist(
  storeRoomNames,
  "有効な教室を入力してください",
);
export type StoreRoom = v.InferOutput<typeof StoreRoom>;

export const Store = v.object({
  id: v.string(),
  name: StoreName,
  room: StoreRoom,
  description: StoreDescription,
  imageUrl: v.string(),
  reviewStatus: StoreReviewStatusSchema,
  allergens: v.array(Allergen),
});

export type Store = v.InferOutput<typeof Store>;
