import { StoreMemberRole } from "@/entities/store-member";
import { createApiClient } from "@/shared/api";
import { getStatusMessage, storeInvitationsUrl } from "@/shared/config";

type CreateStoreInvitationParams = {
  origin: string;
  storeId: string;
  maxUses: number | null;
  role: StoreMemberRole;
};

/**
 * 店舗の招待URLを生成する
 * @param origin ベースURL
 * @param storeId 対象のストアID
 * @param maxUses 招待URLの使用可能回数（nullで無制限）
 * @param role 付与する権限
 * @returns 整形された招待URL
 */
export async function createStoreInvitationUrl({
  origin,
  storeId,
  maxUses,
  role,
}: CreateStoreInvitationParams): Promise<string> {
  const client = await createApiClient();
  const { data, error, response } = await client.POST(
    "/stores/{store_id}/invitations",
    {
      params: {
        path: {
          store_id: storeId,
        },
      },
      body: { maxUses, role },
    },
  );

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  const invitationUrl = new URL(storeInvitationsUrl(data.id), origin);
  return invitationUrl.toString();
}
