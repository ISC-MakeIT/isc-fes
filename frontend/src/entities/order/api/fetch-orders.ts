import { createApiClient } from "@/shared/api";
import { Order, OrderStatus } from "../model/types";
import { getStatusMessage, ordersKey } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";

export async function fetchOrders(statuses?: OrderStatus[]): Promise<Order[]> {
  const client = await createApiClient();
  const { data, error, response } = await client.GET("/orders", {
    params: {
      query: {
        statuses,
      },
    },
  });

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(v.array(Order), data.data);
}

export function ordersQueryOptions(statuses?: OrderStatus[]) {
  return queryOptions({
    queryFn: () => fetchOrders(statuses),
    queryKey: ordersKey(statuses),
  });
}
