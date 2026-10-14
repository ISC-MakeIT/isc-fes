import { components, createApiClient } from "@/shared/api";
import { getStatusMessage, HTTP_STATUS } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { Cart } from "../model/types";

export type UpdateCartInput = components["schemas"]["UpdateCartInput"];

type UpdateCartParams = {
  updateCartInput: UpdateCartInput;
  storeId: string;
};

export async function updateCart({
  updateCartInput,
  storeId,
}: UpdateCartParams) {
  const client = await createApiClient();
  const { data, error, response } = await client.PUT(
    "/stores/{store_id}/carts",
    {
      body: updateCartInput,
      params: {
        path: {
          store_id: storeId,
        },
      },
    },
  );

  if (error) {
    if (response.status === HTTP_STATUS.CONFLICT.code) {
      throw new Error(
        "カートが更新されています。最新の内容を確認してもう一度操作してください。",
      );
    }
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(Cart, data);
}
