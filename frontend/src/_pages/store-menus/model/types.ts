import { MenuDescription, MenuName, MenuUnitPrice } from "@/entities/menu";
import { v } from "@/shared/lib/valibot";
import { UploadImage } from "@/shared/model";

// フォーム用の型
export const MenuFormValues = v.object({
  name: MenuName,
  image: v.optional(UploadImage),
  unitPrice: v.optional(MenuUnitPrice),
  description: MenuDescription,
  // TODO: トッピング
});

export type MenuFormValues = v.InferOutput<typeof MenuFormValues>;

// API用の型
export const CreateMenuInput = v.object({
  name: MenuName,
  image: UploadImage,
  unitPrice: MenuUnitPrice,
  description: MenuDescription,
  // TODO: トッピング
});
export type CreateMenuInput = v.InferOutput<typeof CreateMenuInput>;

export const EditMenuInput = v.object({
  name: MenuName,
  // 編集時は画像を選択しなかったら今の画像が維持される
  image: v.optional(UploadImage),
  unitPrice: MenuUnitPrice,
  description: MenuDescription,
  // TODO: トッピング
});
export type EditMenuInput = v.InferOutput<typeof EditMenuInput>;
