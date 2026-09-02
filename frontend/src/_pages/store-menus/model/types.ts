import { MenuDescription, MenuName, MenuUnitPrice } from "@/entities/menu";
import { v } from "@/shared/lib/valibot";
import { UploadImage } from "@/shared/model/upload-image";

// メニューのフォーム用の型
export const MenuFormValues = v.object({
  name: MenuName,
  image: v.optional(UploadImage),
  unitPrice: v.optional(MenuUnitPrice),
  description: MenuDescription,
  // TODO: トッピング
});

export type MenuFormValues = v.InferOutput<typeof MenuFormValues>;
