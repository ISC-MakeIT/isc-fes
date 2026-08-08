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
  // 画像はバイナリをそのままバックエンドに渡せばいい感じに登録してくれるので
  // フロント側ではFileかどうかだけをチェックする
  image: v.optional(v.instance(File)),
});

export type CreateStoreForm = v.InferOutput<typeof CreateStoreForm>;
