import { createApiClient } from "@/shared/api";
import { EditMenuInput } from "../model/types";
import { buildFormDataBody } from "@/shared/lib/build-form-data-body";
import { v } from "@/shared/lib/valibot";
import { Menu } from "@/entities/menu";
import { getStatusMessage } from "@/shared/config";

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
