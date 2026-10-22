import { createApiClient } from "@/shared/api";
import { getStatusMessage, storeListKeys } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";
import { Store } from "../model/types";

const StoreRankingItem = v.object({
  ...Store.entries,
  place: v.picklist([1, 2, 3]),
});

export type StoreRankingItem = v.InferOutput<typeof StoreRankingItem>;

export async function fetchStoreRanking(): Promise<StoreRankingItem[]> {
  const client = await createApiClient();
  const { data, error, response } = await client.GET("/stores/ranking");

  if (error) throw new Error(getStatusMessage(response.status));

  return v.parse(v.array(StoreRankingItem), data.data);
}

export function storeRankingQueryOptions() {
  return queryOptions({
    queryKey: storeListKeys.ranking(),
    queryFn: fetchStoreRanking,
    refetchInterval: 60_000,
  });
}
