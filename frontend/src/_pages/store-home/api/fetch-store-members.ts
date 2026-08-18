import { StoreMember } from "@/entities/store-member";
import { createApiClient } from "@/shared/api";
import { getStatusMessage, storeMembersKey } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";

export async function fetchStoreMembers(storeId: string) {
  const client = await createApiClient();
  const { data, error, response } = await client.GET(
    "/stores/{store_id}/members",
    {
      params: { path: { store_id: storeId } },
    },
  );

  if (error) throw new Error(getStatusMessage(response.status));

  return v.parse(v.array(StoreMember), data.data);
}

export function storeMemberQueryOptions(storeId: string) {
  return queryOptions({
    queryKey: storeMembersKey(storeId),
    queryFn: () => fetchStoreMembers(storeId),
    staleTime: 60 * 1000,
  });
}
