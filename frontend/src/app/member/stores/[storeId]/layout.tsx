import { storeMemberByAccountIdQueryOptions } from "@/entities/store-member";
import { currentAccountQueryOptions } from "@/entities/account";
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

  const currentMember = await queryClient.fetchQuery(
    storeMemberByAccountIdQueryOptions(storeId, account.id),
  );

  if (!currentMember) {
    notFound();
  }

  return (
    <AppSidebarLayout
      sidebar={{ variant: "store", storeId, memberRole: currentMember.role }}
    >
      {props.children}
    </AppSidebarLayout>
  );
}
