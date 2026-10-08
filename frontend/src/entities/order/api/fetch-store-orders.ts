import { createApiClient } from "@/shared/api";
import { Order } from "../model/types";
import { getStatusMessage, storeOrdersKey } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";

type FetchStoreOrdersParams = {
  storeId: string;
};

export async function fetchStoreOrders({
  storeId,
}: FetchStoreOrdersParams): Promise<Order[]> {
  const client = await createApiClient();
  const { data, error, response } = await client.GET(
    "/stores/{store_id}/orders",
    {
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

  return v.parse(v.array(Order), data.data);
}

export function storeOrdersQueryOptions(storeId: string) {
  return queryOptions({
    queryFn: () => fetchStoreOrders({ storeId }),
    queryKey: storeOrdersKey(storeId),
    staleTime: 10_000,
  });
}
