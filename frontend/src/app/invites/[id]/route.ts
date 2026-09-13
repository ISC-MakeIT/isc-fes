import { fetchCurrentAccount } from "@/entities/account";
import { loginUrl, storeHomeUrl, storeInvitationsUrl } from "@/shared/config";
import { redirect } from "next/navigation";
import { storeInvitationAccept } from "./_api/store-invitation-accept";

export async function GET(
  request: Request,
  context: RouteContext<"/invites/[id]">,
) {
  const { id: invitationId } = await context.params;
  const account = await fetchCurrentAccount();

  if (!account) {
    const redirectTo = storeInvitationsUrl(invitationId);
    redirect(loginUrl(redirectTo));
  }

  const { storeId } = await storeInvitationAccept(invitationId);

  if (!storeId) {
    // TODO:エラーをユーザーにフィードバックしてあげたいけど画面が存在しないので要相談
    return;
  }

  redirect(storeHomeUrl(storeId));
}
