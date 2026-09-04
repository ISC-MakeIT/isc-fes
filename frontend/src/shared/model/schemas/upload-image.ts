import { v } from "../../lib/valibot";

export const UploadImage = v.pipe(
  v.file("画像を選択してください"),
  v.mimeType(
    ["image/jpeg", "image/png", "image/webp"],
    "対応していない画像形式です",
  ),
  v.maxSize(10 * 1024 * 1024, "10MB以内の画像を選択してください"),
);
