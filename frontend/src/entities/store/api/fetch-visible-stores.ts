import { Store } from "@/entities/store/model/types";
import { createApiClient } from "@/shared/api";
import { storesKey } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";

/**
 * 承認済みの全店舗と自分が申請した店舗を返す
 * @returns
 */
export async function fetchVisibleStores(): Promise<Store[]> {
  const client = await createApiClient();
  const { data, error } = await client.GET("/stores");

  if (error) throw new Error(`データの取得に失敗しました`);

  const parsed = v.parse(v.array(Store), data.data);

  return parsed;
}

export function visibleStoresQueryOptions() {
  return queryOptions({
    queryFn: fetchVisibleStores,
    queryKey: storesKey(),
  });
}
