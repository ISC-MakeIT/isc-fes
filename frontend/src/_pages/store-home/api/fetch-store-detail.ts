import { Store } from "@/entities/store";
import { createApiClient } from "@/shared/api";
import { getStatusMessage, keys } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";

export async function fetchStoreDetail(storeId: string): Promise<Store> {
  const client = await createApiClient();
  const { data, error, response } = await client.GET("/stores/{store_id}", {
    params: { path: { store_id: storeId } },
  });

  if (error) throw new Error(getStatusMessage(response.status));

  return v.parse(Store, data);
}

export function storeDetailQueryOptions(storeId: string) {
  return queryOptions({
    queryKey: keys.storeDetail(storeId),
    queryFn: () => fetchStoreDetail(storeId),
  });
}
