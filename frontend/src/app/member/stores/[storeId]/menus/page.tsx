import { StoreMenusView } from "@/_pages/store-menus";
import { currentAccountQueryOptions } from "@/entities/account";
import {
  storeMemberByAccountIdQueryOptions,
  StoreMemberRole,
} from "@/entities/store-member";
import { createQueryClient } from "@/shared/api";
import { loginUrl, storeListUrl } from "@/shared/config";
import { notFound, redirect } from "next/navigation";

export default async function StoreMenusPage({
  params,
}: PageProps<"/member/stores/[storeId]/menus">) {
  const { storeId } = await params;

  const queryClient = createQueryClient();
  const account = await queryClient.fetchQuery(currentAccountQueryOptions());
  if (!account) {
    redirect(loginUrl(storeListUrl()));
  }

  const currentMember = await queryClient.fetchQuery(
    storeMemberByAccountIdQueryOptions(storeId, account.id),
  );

  if (currentMember.role === StoreMemberRole.Staff) {
    notFound();
  }

  return <StoreMenusView storeId={storeId} />;
}
