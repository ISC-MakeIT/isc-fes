import { createApiClient } from "@/shared/api";
import { Order, OrderStatus } from "../model/types";
import { getStatusMessage, storeOrdersKey } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";

type FetchStoreOrdersParams = {
  storeId: string;
  statuses?: OrderStatus[];
};

export async function fetchStoreOrders({
  storeId,
  statuses,
}: FetchStoreOrdersParams): Promise<Order[]> {
  const client = await createApiClient();
  const { data, error, response } = await client.GET(
    "/stores/{store_id}/orders",
    {
      params: {
        path: {
          store_id: storeId,
        },
        query: {
          statuses,
        },
      },
    },
  );

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(v.array(Order), data.data);
}

export function storeOrdersQueryOptions(
  storeId: string,
  statuses?: OrderStatus[],
) {
  return queryOptions({
    queryFn: () => fetchStoreOrders({ storeId, statuses }),
    queryKey: storeOrdersKey(storeId, statuses),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}
