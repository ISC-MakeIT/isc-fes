import { createApiClient } from "@/shared/api";
import { getStatusMessage } from "@/shared/config";

type DeleteStoreMemberByIdParams = {
  storeId: string;
  accountId: string;
};

export async function deleteStoreMemberById({
  storeId,
  accountId,
}: DeleteStoreMemberByIdParams) {
  const client = await createApiClient();
  const { error, response } = await client.DELETE(
    "/stores/{store_id}/members/{account_id}",
    {
      params: {
        path: {
          account_id: accountId,
          store_id: storeId,
        },
      },
    },
  );

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }
}
