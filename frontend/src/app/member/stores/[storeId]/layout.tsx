import { storeMemberByAccountIdQueryOptions } from "@/entities/store-member";
import { currentAccountQueryOptions } from "@/entities/account";
import { createQueryClient } from "@/shared/api";
import { loginUrl, storeListUrl } from "@/shared/config";
import {
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/shared/ui/sidebar";
import {
  AppSidebar,
  createStoreNavigationItems,
  DesktopAppHeader,
  MobileAppHeader,
  SidebarSupportNavigation,
} from "@/widgets/app-sidebar";
import { notFound, redirect } from "next/navigation";
import { DotText } from "@/shared/ui/dot-text";
import Link from "next/link";
import {
  SidebarNavigation,
  sidebarNavigationStyle,
} from "@/widgets/app-sidebar";

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

  const storeSidebarNavigationItems = createStoreNavigationItems(
    storeId,
    currentMember.role,
  );

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "10rem",
        } as React.CSSProperties
      }
      defaultOpen
    >
      <AppSidebar>
        <div className="space-y-6">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className={sidebarNavigationStyle}
                render={<Link href={storeListUrl()} />}
              >
                <DotText className="text-primary">店舗一覧</DotText>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <SidebarMenu>
            <SidebarNavigation navigationItems={storeSidebarNavigationItems} />
          </SidebarMenu>

          <SidebarMenu>
            <SidebarSupportNavigation />
          </SidebarMenu>
        </div>
      </AppSidebar>
      {/* NOTE: モバイルとデスクトップでヘッダーの位置も呼び出し箇所も大きく変わるのでコンポーネントも分けている */}
      <DesktopAppHeader />

      <SidebarInset>
        <MobileAppHeader />
        {props.children}
      </SidebarInset>
    </SidebarProvider>
  );
}
