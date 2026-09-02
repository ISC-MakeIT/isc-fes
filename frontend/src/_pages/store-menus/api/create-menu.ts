import {
  Menu,
  MenuDescription,
  MenuName,
  MenuUnitPrice,
} from "@/entities/menu";
import { MenuFormValues } from "../model/types";
import { createApiClient } from "@/shared/api";
import { buildFormDataBody } from "@/shared/lib/build-form-data-body";
import { getStatusMessage } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { UploadImage } from "@/shared/model/upload-image";

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
  formValues: MenuFormValues;
};

export async function createMenu({ formValues, storeId }: CreateMenuParams) {
  const createMenuInput = v.parse(CreateMenuInput, formValues);

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
