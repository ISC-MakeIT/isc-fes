import { Order } from "@/entities/order";
import { components, createApiClient } from "@/shared/api";
import { getStatusMessage, isClientError } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { trackEvent } from "@/shared/lib/analytics";

type CreateOrderInput = components["schemas"]["CreateOrderInput"];

export async function createOrder({
  storeId,
  expectedCartVersion,
}: CreateOrderInput): Promise<Order> {
  const client = await createApiClient();
  const { data, error, response } = await client.POST("/orders", {
    body: {
      storeId,
      expectedCartVersion,
    },
  });

  if (error) {
    if (response.status === 403 && error.code === "guest_order_too_early") {
      trackEvent("order_wait_blocked", { store_id: storeId });
    }

    if (isClientError(response.status) && error.message) {
      throw new Error(error.message);
    }

    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(Order, data);
}
