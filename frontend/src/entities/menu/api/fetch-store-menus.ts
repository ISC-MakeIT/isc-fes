import { Menu } from "@/entities/menu";
import { createApiClient } from "@/shared/api";
import { getStatusMessage, storeMenusKey } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";

export async function fetchStoreMenus(storeId: string): Promise<Menu[]> {
  const client = await createApiClient();
  const { data, error, response } = await client.GET(
    "/stores/{store_id}/menus",
    {
      params: { path: { store_id: storeId } },
    },
  );

  if (error) throw new Error(getStatusMessage(response.status));

  return v.parse(v.array(Menu), data.data);
}

export function storeMenusQueryOptions(storeId: string) {
  return queryOptions({
    queryKey: storeMenusKey(storeId),
    queryFn: () => fetchStoreMenus(storeId),
    staleTime: 60 * 1000,
  });
}
