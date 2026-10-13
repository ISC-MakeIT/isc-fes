import { components, createApiClient } from "@/shared/api";
import { checkoutableKey, getStatusMessage } from "@/shared/config";
import { queryOptions } from "@tanstack/react-query";

export type CheckoutCode = NonNullable<
  components["schemas"]["CheckoutCheckResponse"]["code"]
>;

export async function fetchCheckoutable(
  storeId: string,
  expectedCartVersion: number,
) {
  const client = await createApiClient();
  const { data, error, response } = await client.GET(
    "/stores/{store_id}/carts/checkoutable",
    {
      params: {
        query: {
          expectedCartVersion: expectedCartVersion,
        },
        path: {
          store_id: storeId,
        },
      },
    },
  );

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return data;
}

export function checkCheckoutQueryOptions(
  storeId: string,
  expectedCartVersion: number,
) {
  return queryOptions({
    queryFn: () => fetchCheckoutable(storeId, expectedCartVersion),
    queryKey: checkoutableKey(storeId, expectedCartVersion),
  });
}
