import { fetchCurrentAccount } from "@/entities/account";
import { loginUrl, storeHomeUrl } from "@/shared/config";
import { redirect } from "next/navigation";
import { storeInvitationAccept } from "./_api/store-invitation-accept";

export async function GET(
  request: Request,
  context: RouteContext<"/invites/[id]">,
) {
  const { id: invitationId } = await context.params;
  const account = await fetchCurrentAccount();

  // TODO: ログイン後にここに戻ってくるようにする
  //       いまはバックエンドの実装待ち
  if (!account) redirect(loginUrl());

  const { storeId } = await storeInvitationAccept(invitationId);

  if (!storeId) {
    // TODO:エラーをユーザーにフィードバックしてあげたいけど画面が存在しないので要相談
    return;
  }

  redirect(storeHomeUrl(storeId));
}
