import { Topping } from "@/entities/topping";
import { createApiClient } from "@/shared/api";
import { getStatusMessage, storeToppingsKey } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";

type FetchStoreToppingsParams = {
  storeId: string;
};

export async function fetchStoreToppings({
  storeId,
}: FetchStoreToppingsParams) {
  const apiClient = await createApiClient();
  const { data, error, response } = await apiClient.GET(
    "/stores/{store_id}/toppings",
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

  return v.parse(v.array(Topping), data.data);
}

export function storeToppingsQueryOptions(storeId: string) {
  return queryOptions({
    queryKey: storeToppingsKey(storeId),
    queryFn: () => fetchStoreToppings({ storeId }),
  });
}
