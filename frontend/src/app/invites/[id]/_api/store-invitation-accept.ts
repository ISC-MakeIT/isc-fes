import { createApiClient } from "@/shared/api";
import { getStatusMessage, isClientError } from "@/shared/config";

type StoreInvitationAcceptResult =
  | { storeId: string; errorMessage?: never }
  | { storeId?: never; errorMessage: string };

export async function storeInvitationAccept(
  invitationId: string,
): Promise<StoreInvitationAcceptResult> {
  const client = await createApiClient();
  const { data, error, response } = await client.POST(
    "/store-invitations/{invitation_id}/accept",
    {
      params: {
        path: {
          invitation_id: invitationId,
        },
      },
    },
  );

  if (error) {
    if (isClientError(response.status)) {
      return { errorMessage: getStatusMessage(response.status) };
    } else {
      throw new Error(getStatusMessage(response.status));
    }
  }

  return { storeId: data.storeId };
}
