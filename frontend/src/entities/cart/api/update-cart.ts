import { components, createApiClient } from "@/shared/api";
import { getStatusMessage } from "@/shared/config";
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
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(Cart, data);
}
