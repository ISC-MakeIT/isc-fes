import { Menu } from "@/entities/menu";
import { createApiClient } from "@/shared/api";
import { buildFormDataBody } from "@/shared/lib/build-form-data-body";
import { getStatusMessage } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { CreateMenuInput } from "../model/types";

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
