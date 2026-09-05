import { createApiClient } from "@/shared/api";
import { buildFormDataBody } from "@/shared/lib/build-form-data-body";
import { v } from "@/shared/lib/valibot";
import {
  Menu,
  MenuDescription,
  MenuName,
  MenuUnitPrice,
} from "@/entities/menu";
import { getStatusMessage } from "@/shared/config";
import { UploadImage } from "@/shared/model";

// API送信時の型
// TODO: このAPI内ではOpenAPIの自動生成の型を使った方が綺麗かも
export const EditMenuInput = v.object({
  name: MenuName,
  // 編集時は画像を選択しなかったら今の画像が維持される
  image: v.optional(UploadImage),
  unitPrice: MenuUnitPrice,
  description: MenuDescription,
  // TODO: トッピング
});
export type EditMenuInput = v.InferOutput<typeof EditMenuInput>;

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
  const client = await createApiClient();
  const { data, error, response } = await client.PUT(
    "/stores/{store_id}/menus/{menu_id}",
    {
      body: editMenuInput as never,
      bodySerializer: (body) => buildFormDataBody(body),
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
