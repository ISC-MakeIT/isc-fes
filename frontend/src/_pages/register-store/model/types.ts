import { v } from "@/shared/lib/valibot";

export const CreateStoreForm = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "1文字以上で入力してください"),
    v.maxLength(100, "100文字以内で入力してください"),
  ),
  room: v.pipe(
    v.string(),
    v.minLength(1, "1文字以上で入力してください"),
    v.maxLength(50, "50文字以内で入力してください"),
  ),
  description: v.pipe(
    v.string(),
    v.minLength(1, "1文字以上で入力してください"),
    v.maxLength(1000, "1000文字以内で入力してください"),
  ),
  // Inputの初期値用にundefinedを許容する
  image: v.optional(
    v.pipe(
      v.file(),
      v.mimeType(
        ["image/jpeg", "image/png", "image/webp"],
        "対応していない画像形式です",
      ),
      v.maxSize(10 * 1024 * 1024, "10MB以内の画像を選択してください"),
    ),
  ),
});

export type CreateStoreForm = v.InferOutput<typeof CreateStoreForm>;
