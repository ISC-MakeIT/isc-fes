import { Store } from "@/entities/store";
import { createApiClient } from "@/shared/api";
import { getStatusMessage, STATUS, storeDetailKey } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";
import { notFound } from "next/navigation";

export async function fetchStoreDetail(storeId: string): Promise<Store> {
  const client = await createApiClient();
  const { data, error, response } = await client.GET("/stores/{store_id}", {
    params: { path: { store_id: storeId } },
  });

  if (error) {
    if (response.status === STATUS.NOT_FOUND.code) notFound();
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(Store, data);
}

export function storeDetailQueryOptions(storeId: string) {
  return queryOptions({
    queryKey: storeDetailKey(storeId),
    queryFn: () => fetchStoreDetail(storeId),
    // 店舗情報は基本的に変わることがない
    staleTime: Infinity,
  });
}
