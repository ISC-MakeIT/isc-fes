import { ErrorBoundary } from "react-error-boundary";
import { storeDetailQueryOptions } from "../api/fetch-store-detail";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { StoreInfo } from "./store-detail";
import { createQueryClient } from "@/shared/api";
import { StoreMenuList } from "./store-menu-list";
import { StoreMemberList } from "./store-member-list";
import { storeMenusQueryOptions } from "../api/fetch-store-menus";
import { storeMemberQueryOptions } from "../api/fetch-store-members";
import { AppSidebar } from "./app-sidebar";
import { SidebarInset } from "@/shared/ui/sidebar";
import { DesktopStoreHeader } from "./desktop-store-header";
import { MobileStoreHeader } from "./mobile-store-header";
import { createStoreNavigationItems } from "../config/create-store-navigation-items";
import { HeadingCard } from "@/shared/ui/heading-card";
import { currentAccountQueryOptions } from "@/entities/account";

type StoreHomeViewProps = { storeId: string };

export async function StoreHomeView({ storeId }: StoreHomeViewProps) {
  const queryClient = createQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(currentAccountQueryOptions()),
    queryClient.prefetchQuery(storeDetailQueryOptions(storeId)),
    queryClient.prefetchQuery(storeMenusQueryOptions(storeId)),
    queryClient.prefetchQuery(storeMemberQueryOptions(storeId)),
  ]);

  const storeNavigation = createStoreNavigationItems(storeId);

  return (
    <>
      <AppSidebar navigationItems={storeNavigation} />
      {/* NOTE: モバイルとデスクトップでヘッダーの位置も呼び出し箇所も大きく変わるのでコンポーネントも分けている */}
      <DesktopStoreHeader />

      <SidebarInset>
        <MobileStoreHeader />
        <HydrationBoundary state={dehydrate(queryClient)}>
          <ErrorBoundary fallback={<p>エラーが発生しました</p>}>
            <Suspense fallback={<p>ロード中</p>}>
              <div className="py-18">
                <HeadingCard className="mb-6 md:hidden">ホーム</HeadingCard>
                <StoreInfo storeId={storeId} />
                <div className="md:grid md:grid-cols-[1fr_24rem]">
                  <StoreMenuList
                    className="hidden md:block"
                    storeId={storeId}
                  />
                  <StoreMemberList storeId={storeId} />
                </div>
              </div>
            </Suspense>
          </ErrorBoundary>
        </HydrationBoundary>
      </SidebarInset>
    </>
  );
}
