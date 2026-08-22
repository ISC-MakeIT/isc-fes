import { SidebarInset } from "@/shared/ui/sidebar";
import {
  adminNavigationItems,
  AppSidebar,
  DesktopAppHeader,
  MobileAppHeader,
} from "@/widgets/app-sidebar";
import { StoreReview } from "./store-review";
import { createQueryClient } from "@/shared/api";
import { storeApplicationQueryOptions } from "../api/fetch-store-applications";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";

export async function StoreApplicationsView() {
  const queryClient = createQueryClient();
  await queryClient.prefetchQuery(storeApplicationQueryOptions());

  return (
    <>
      <AppSidebar navigationItems={adminNavigationItems()} />
      <DesktopAppHeader />

      <SidebarInset>
        <MobileAppHeader />
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<p>ロード中</p>}>
            <ErrorBoundary fallback={<p>エラーが発生しました</p>}>
              <StoreReview />
            </ErrorBoundary>
          </Suspense>
        </HydrationBoundary>
      </SidebarInset>
    </>
  );
}
