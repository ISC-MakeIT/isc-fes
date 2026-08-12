import { StoreDescription, StoreName, StoreRoom } from "@/entities/store";
import { v } from "@/shared/lib/valibot";

export const CreateStoreFormImage = v.pipe(
  v.file("画像を選択してください"),
  v.mimeType(
    ["image/jpeg", "image/png", "image/webp"],
    "対応していない画像形式です",
  ),
  v.maxSize(10 * 1024 * 1024, "10MB以内の画像を選択してください"),
);

export const CreateStoreForm = v.object({
  name: StoreName,
  description: StoreDescription,
  room: StoreRoom,
  // Inputの初期値用にundefinedを許容する
  image: v.optional(CreateStoreFormImage),
});

export type CreateStoreForm = v.InferOutput<typeof CreateStoreForm>;
