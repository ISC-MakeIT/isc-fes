import { v } from "@/shared/lib/valibot";

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

export const StoreImage = v.pipe(
  v.file("画像を選択してください"),
  v.mimeType(
    ["image/jpeg", "image/png", "image/webp"],
    "対応していない画像形式です",
  ),
  v.maxSize(10 * 1024 * 1024, "10MB以内の画像を選択してください"),
);

export const Store = v.object({
  name: StoreName,
  room: StoreRoom,
  description: StoreDescription,
  image: StoreImage,
});
