import { createApiClient, uploadImage } from "@/shared/api";
import { v } from "@/shared/lib/valibot";
import {
  Menu,
  MenuDescription,
  MenuName,
  MenuSoldOut,
  MenuUnitPrice,
} from "@/entities/menu";
import { getStatusMessage } from "@/shared/config";
import { UploadImage } from "@/shared/model";
import { ToppingId } from "@/entities/topping";

// API送信時の型
// TODO: このAPI内ではOpenAPIの自動生成の型を使った方が綺麗かも
const EditMenuInput = v.object({
  name: v.optional(MenuName),
  // 編集時は画像を選択しなかったら今の画像が維持される
  image: v.optional(UploadImage),
  unitPrice: v.optional(MenuUnitPrice),
  description: v.optional(MenuDescription),
  soldOut: v.optional(MenuSoldOut),
  toppingIds: v.optional(v.array(ToppingId)),
});
type EditMenuInput = v.InferOutput<typeof EditMenuInput>;

type EditMenuParms = {
  storeId: string;
  menuId: string;
  editMenuInput: EditMenuInput;
};

export async function editMenu({
  menuId,
  storeId,
  editMenuInput,
}: EditMenuParms) {
  const { image, ...menuInput } = editMenuInput;
  const uploadResult = image && (await uploadImage(image));
  if (uploadResult && uploadResult.data === undefined) {
    throw new Error(uploadResult.error);
  }

  const client = await createApiClient();
  const { data, error, response } = await client.PATCH(
    "/stores/{store_id}/menus/{menu_id}",
    {
      body: {
        ...menuInput,
        imageObjectKey: uploadResult?.data.imageObjectKey,
      },
      params: {
        path: {
          store_id: storeId,
          menu_id: menuId,
        },
      },
    },
  );

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(Menu, data);
}
