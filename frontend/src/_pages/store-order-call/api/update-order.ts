import { Order } from "@/entities/order";
import { components, createApiClient } from "@/shared/api";
import { getStatusMessage } from "@/shared/config";
import { v } from "@/shared/lib/valibot";

type UpdateOrderParams = {
  storeId: string;
  orderId: string;
  input: components["schemas"]["UpdateOrderInput"];
};

export async function updateOrder({
  orderId,
  storeId,
  input,
}: UpdateOrderParams) {
  const client = await createApiClient();

  const { data, error, response } = await client.PATCH(
    "/stores/{store_id}/orders/{order_id}",
    {
      params: {
        path: {
          store_id: storeId,
          order_id: orderId,
        },
      },
      body: input,
    },
  );

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(Order, data);
}
