import { createApiClient } from "@/shared/api";
import { checkCheckoutKey, getStatusMessage } from "@/shared/config";
import { queryOptions } from "@tanstack/react-query";

export async function checkCheckout(
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
    queryFn: () => checkCheckout(storeId, expectedCartVersion),
    queryKey: checkCheckoutKey(storeId),
  });
}
