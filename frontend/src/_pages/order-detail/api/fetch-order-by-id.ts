import { Order } from "@/entities/order";
import { createApiClient } from "@/shared/api";
import { getStatusMessage, orderDetailKey } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";

type FetchOrderByIdParams = {
  orderId: string;
};

export async function fetchOrderById({ orderId }: FetchOrderByIdParams) {
  const client = await createApiClient();
  const { data, error, response } = await client.GET("/orders/{order_id}", {
    params: {
      path: {
        order_id: orderId,
      },
    },
  });

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(Order, data);
}

export function fetchOrderByidQueryOptions(orderId: string) {
  return queryOptions({
    queryFn: () => fetchOrderById({ orderId }),
    queryKey: orderDetailKey(orderId),
    // チケットのスタンプをwebsocket使って実装しないなら数秒ごとにfetchさせる
    staleTime: Infinity,
  });
}
