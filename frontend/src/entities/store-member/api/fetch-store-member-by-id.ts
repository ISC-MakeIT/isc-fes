import { StoreMember } from "@/entities/store-member";
import { createApiClient } from "@/shared/api";
import { getStatusMessage, storeMemberKey } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";

type FetchStoreMemberByAccountIdParams = {
  storeId: string;
  accountId: string;
};

export async function fetchStoreMemberByAccountId({
  storeId,
  accountId,
}: FetchStoreMemberByAccountIdParams) {
  const client = await createApiClient();
  const { data, error, response } = await client.GET(
    "/stores/{store_id}/members/{account_id}",
    {
      params: {
        path: {
          store_id: storeId,
          account_id: accountId,
        },
      },
    },
  );

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(StoreMember, data);
}

export function storeMemberByAccountIdQueryOptions(
  storeId: string,
  accountId: string,
) {
  return queryOptions({
    queryKey: storeMemberKey(storeId, accountId),
    queryFn: () => fetchStoreMemberByAccountId({ storeId, accountId }),
    // メンバーの状態が変わることは基本的にない
    staleTime: Infinity,
  });
}
