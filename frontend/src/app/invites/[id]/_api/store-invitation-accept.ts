import { createApiClient } from "@/shared/api";
import { getStatusMessage, HTTP_STATUS } from "@/shared/config";

type StoreInvitationAcceptResult =
  | { ok: true; storeId: string }
  | { ok: false; errorMessage: string; status: number };

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
    let errorMessage = getStatusMessage(response.status);

    if (response.status === HTTP_STATUS.NOT_FOUND.code) {
      errorMessage = "招待が存在しないか、使用回数の上限に達しています。";
    }

    return { ok: false, status: response.status, errorMessage };
  }

  return { ok: true, storeId: data.storeId };
}
