import { MenuDescription, MenuName, MenuUnitPrice } from "@/entities/menu";
import { v } from "@/shared/lib/valibot";
import { UploadImage } from "@/shared/model/upload-image";

export const CreateMenuForm = v.object({
  name: MenuName,
  image: v.optional(UploadImage),
  unitPrice: MenuUnitPrice,
  description: MenuDescription,
  // TODO: トッピング
});
