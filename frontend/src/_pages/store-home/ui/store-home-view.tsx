import { storeDetailQueryOptions } from "../api/fetch-store-detail";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { StoreInfo } from "./store-info";
import { createQueryClient } from "@/shared/api";
import { StoreMenuList } from "./store-menu-list";
import { StoreMemberList } from "./store-member-list";
import { storeMenusQueryOptions } from "../api/fetch-store-menus";
import { storeMemberQueryOptions } from "../api/fetch-store-members";
import { AppSidebar } from "@/widgets/app-sidebar";
import { SidebarInset } from "@/shared/ui/sidebar";
import { DesktopAppHeader } from "@/widgets/app-sidebar";
import { MobileAppHeader } from "@/widgets/app-sidebar";
import { storeNavigationItems } from "@/widgets/app-sidebar";
import { HeadingCard } from "@/shared/ui/heading-card";
import { currentAccountQueryOptions } from "@/entities/account";
import { redirect } from "next/navigation";
import { loginUrl } from "@/shared/config";

type StoreHomeViewProps = { storeId: string };

export async function StoreHomeView({ storeId }: StoreHomeViewProps) {
  const queryClient = createQueryClient();

  const [currentAccount] = await Promise.all([
    queryClient.fetchQuery(currentAccountQueryOptions()),
    queryClient.prefetchQuery(storeDetailQueryOptions(storeId)),
    queryClient.prefetchQuery(storeMenusQueryOptions(storeId)),
    queryClient.prefetchQuery(storeMemberQueryOptions(storeId)),
  ]);

  if (!currentAccount) redirect(loginUrl());

  return (
    <>
      <AppSidebar navigationItems={storeNavigationItems(storeId)} />
      {/* NOTE: モバイルとデスクトップでヘッダーの位置も呼び出し箇所も大きく変わるのでコンポーネントも分けている */}
      <DesktopAppHeader />

      <SidebarInset>
        <MobileAppHeader />
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<p>ロード中</p>}>
            <div className="flex flex-1 flex-col pt-18">
              <HeadingCard className="mb-6 self-center md:hidden">
                ホーム
              </HeadingCard>
              <StoreInfo storeId={storeId} />
              <div className="md:grid md:flex-1 md:grid-cols-[1fr_24rem]">
                <StoreMenuList className="hidden md:block" storeId={storeId} />
                <StoreMemberList
                  storeId={storeId}
                  accountId={currentAccount.id}
                />
              </div>
            </div>
          </Suspense>
        </HydrationBoundary>
      </SidebarInset>
    </>
  );
}
