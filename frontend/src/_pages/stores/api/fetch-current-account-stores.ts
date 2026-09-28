import { Store } from "@/entities/store";
import { createApiClient } from "@/shared/api";
import { getStatusMessage, storeListKeys } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";

/**
 * 自分が所属している店舗と申請した店舗一覧を返す
 * @returns
 */
export async function fetchCurrentAccountStores(): Promise<Store[]> {
  const client = await createApiClient();
  const { data, error, response } = await client.GET("/stores", {
    params: {
      query: {
        member_only: true,
      },
    },
  });

  if (error) throw new Error(getStatusMessage(response.status));

  const parsed = v.parse(v.array(Store), data.data);

  return parsed;
}

export function currentAccountStoresQueryOptions() {
  return queryOptions({
    queryFn: fetchCurrentAccountStores,
    queryKey: storeListKeys.currentAccount(),
  });
}
