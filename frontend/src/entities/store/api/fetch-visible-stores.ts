import { Store } from "../model/types";
import { createApiClient } from "@/shared/api";
import { getStatusMessage, storeListKeys } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";

/**
 * 現在のアカウントから閲覧可能な店舗一覧を返す
 * @returns
 */
export async function fetchVisibleStores(): Promise<Store[]> {
  const client = await createApiClient();
  const { data, error, response } = await client.GET("/stores");

  if (error) throw new Error(getStatusMessage(response.status));

  const parsed = v.parse(v.array(Store), data.data);

  return parsed;
}

export function visibleStoresQueryOptions() {
  return queryOptions({
    queryFn: fetchVisibleStores,
    queryKey: storeListKeys.visible(),
  });
}
