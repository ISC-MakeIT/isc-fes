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
import { StoreSidebar } from "./store-sidebar";
import { SidebarInset } from "@/shared/ui/sidebar";
import { DesktopStoreHeader } from "./desktop-store-header";
import { MobileStoreHeader } from "./mobile-store-header";

type StoreHomeViewProps = { storeId: string };

export async function StoreHomeView({ storeId }: StoreHomeViewProps) {
  const queryClient = createQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(storeDetailQueryOptions(storeId)),
    queryClient.prefetchQuery(storeMenusQueryOptions(storeId)),
    queryClient.prefetchQuery(storeMemberQueryOptions(storeId)),
  ]);
  return (
    <>
      <StoreSidebar storeId={storeId} />
      {/* NOTE: モバイルとデスクトップでヘッダーの位置も呼び出し箇所も大きく変わるのでコンポーネントも分けている */}
      <DesktopStoreHeader />

      <SidebarInset>
        <MobileStoreHeader />
        <HydrationBoundary state={dehydrate(queryClient)}>
          <ErrorBoundary fallback={<p>エラーが発生しました</p>}>
            <Suspense fallback={<p>ロード中</p>}>
              <StoreInfo storeId={storeId} />
              <StoreMenuList storeId={storeId} />
              <StoreMemberList storeId={storeId} />
            </Suspense>
          </ErrorBoundary>
        </HydrationBoundary>
      </SidebarInset>
    </>
  );
}
