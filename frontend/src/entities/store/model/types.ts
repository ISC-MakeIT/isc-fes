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

export const StoreRoom = v.pipe(
  v.string(),
  v.minLength(1, "1文字以上で入力してください"),
  v.maxLength(50, "50文字以内で入力してください"),
);

export const StoreDescription = v.pipe(
  v.string(),
  v.minLength(1, "1文字以上で入力してください"),
  v.maxLength(1000, "1000文字以内で入力してください"),
);

export const Store = v.object({
  id: v.string(),
  name: StoreName,
  room: StoreRoom,
  description: StoreDescription,
  imageUrl: v.string(),
  reviewStatus: StoreReviewStatusSchema,
});

export type Store = v.InferOutput<typeof Store>;
