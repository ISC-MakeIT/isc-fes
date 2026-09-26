import { Cart } from "@/entities/cart";
import { createApiClient } from "@/shared/api";
import { cartKey, getStatusMessage } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";

type FetchCartParams = {
  storeId: string;
};

export async function fetchCart({ storeId }: FetchCartParams): Promise<Cart> {
  const client = await createApiClient();
  const { data, error, response } = await client.GET(
    "/stores/{store_id}/carts",
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

  return v.parse(Cart, data);
}

export function fetchCartQueryOptions(storeId: string) {
  return queryOptions({
    queryKey: cartKey(storeId),
    queryFn: () => fetchCart({ storeId }),
    staleTime: 0,
  });
}
