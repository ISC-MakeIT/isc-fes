import { components, createApiClient } from "@/shared/api";
import { getStatusMessage } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { Cart } from "../model/types";

type UpdateCartInput = components["schemas"]["UpdateCartInput"];

type UpdateCartParam = {
  updateCartInput: UpdateCartInput;
  storeId: string;
};

export async function updateCart({
  updateCartInput,
  storeId,
}: UpdateCartParam) {
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
