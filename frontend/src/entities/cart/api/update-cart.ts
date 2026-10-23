import { components, createApiClient } from "@/shared/api";
import { getStatusMessage, HTTP_STATUS } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { Cart } from "../model/types";
import { trackEvent } from "@/shared/lib/analytics";

export type UpdateCartInput = components["schemas"]["UpdateCartInput"];

type UpdateCartParams = {
  updateCartInput: UpdateCartInput;
  storeId: string;
  previousCart: Cart;
};

export async function updateCart({
  updateCartInput,
  storeId,
  previousCart,
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

  const cart = v.parse(Cart, data);
  const previousQuantity = previousCart.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const updatedQuantity = cart.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  if (updatedQuantity > previousQuantity) {
    trackEvent("cart_item_added");
  }
  return cart;
}
