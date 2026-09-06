import {
  Menu,
  MenuDescription,
  MenuName,
  MenuUnitPrice,
} from "@/entities/menu";
import { createApiClient } from "@/shared/api";
import { buildFormDataBody } from "@/shared/lib/build-form-data-body";
import { getStatusMessage } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { UploadImage } from "@/shared/model";

// API送信時の型
// TODO: このAPI内ではOpenAPIの自動生成の型を使った方が綺麗かも
export const CreateMenuInput = v.object({
  name: MenuName,
  image: UploadImage,
  unitPrice: MenuUnitPrice,
  description: MenuDescription,
  // TODO: トッピング
});
export type CreateMenuInput = v.InferOutput<typeof CreateMenuInput>;

type CreateMenuParams = {
  storeId: string;
  createMenuInput: CreateMenuInput;
};

export async function createMenu({
  createMenuInput,
  storeId,
}: CreateMenuParams) {
  const client = await createApiClient();
  const { data, error, response } = await client.POST(
    "/stores/{store_id}/menus",
    {
      params: {
        path: {
          store_id: storeId,
        },
      },
      body: createMenuInput as never,
      bodySerializer: (body) => buildFormDataBody(body),
    },
  );

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(Menu, data);
}
