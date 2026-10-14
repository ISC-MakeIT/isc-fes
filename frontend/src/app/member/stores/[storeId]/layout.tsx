import { storeDetailQueryOptions } from "@/entities/store";
import {
  StoreMemberRole,
  storeMemberByAccountIdQueryOptions,
} from "@/entities/store-member";
import { AccountRole, currentAccountQueryOptions } from "@/entities/account";
import { createQueryClient } from "@/shared/api";
import { loginUrl, storeListUrl } from "@/shared/config";
import { notFound, redirect } from "next/navigation";
import { AppSidebarLayout } from "@/widgets/app-sidebar";

export default async function StoreMemberLayout(
  props: LayoutProps<"/member/stores/[storeId]">,
) {
  const { storeId } = await props.params;

  const queryClient = createQueryClient();
  const account = await queryClient.fetchQuery(currentAccountQueryOptions());
  if (!account) {
    redirect(loginUrl(storeListUrl()));
  }

  if (account.role === AccountRole.Admin) {
    await queryClient.fetchQuery(storeDetailQueryOptions(storeId));
  }

  const currentMember = await queryClient.fetchQuery(
    storeMemberByAccountIdQueryOptions(storeId, account.id),
  );

  const memberRole =
    account.role === AccountRole.Admin
      ? StoreMemberRole.Manager
      : currentMember?.role;
  if (!memberRole) {
    notFound();
  }

  return (
    <AppSidebarLayout
      sidebar={{
        variant: "store",
        storeId,
        memberRole,
      }}
    >
      {props.children}
    </AppSidebarLayout>
  );
}
