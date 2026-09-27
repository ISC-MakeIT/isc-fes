import { storeMemberByAccountIdQueryOptions } from "@/entities/store-member";
import { currentAccountQueryOptions } from "@/entities/account";
import { createQueryClient } from "@/shared/api";
import { loginUrl, storeListUrl } from "@/shared/config";
import { SidebarInset, SidebarProvider } from "@/shared/ui/sidebar";
import {
  AppSidebar,
  DesktopAppHeader,
  MobileAppHeader,
  storeNavigationItems,
} from "@/widgets/app-sidebar";
import { notFound, redirect } from "next/navigation";

export default async function StoreManagerLayout(
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
    <SidebarProvider
      style={
        {
          "--sidebar-width": "10rem",
        } as React.CSSProperties
      }
      defaultOpen={false}
    >
      <AppSidebar
        navigationItems={storeNavigationItems(storeId, currentMember.role)}
      />
      {/* NOTE: モバイルとデスクトップでヘッダーの位置も呼び出し箇所も大きく変わるのでコンポーネントも分けている */}
      <DesktopAppHeader />

      <SidebarInset>
        <MobileAppHeader />
        {props.children}
      </SidebarInset>
    </SidebarProvider>
  );
}
