import { storeDetailQueryOptions } from "../api/fetch-store-detail";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { StoreInfo } from "./store-info";
import { createQueryClient } from "@/shared/api";
import { StoreMenuList } from "./store-menu-list";
import { StoreMembersSection } from "./store-member-section";
import { storeMenusQueryOptions } from "../api/fetch-store-menus";
import { storeMemberQueryOptions } from "../api/fetch-store-members";
import { HeadingCard } from "@/shared/ui/heading-card";

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
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<p>ロード中</p>}>
          <div className="flex flex-1 flex-col pt-18">
            <HeadingCard className="mb-6 self-center md:hidden">
              ホーム
            </HeadingCard>
            <StoreInfo storeId={storeId} />
            <div className="md:grid md:flex-1 md:grid-cols-[1fr_24rem]">
              <StoreMenuList className="hidden md:block" storeId={storeId} />
              <StoreMembersSection storeId={storeId} />
            </div>
          </div>
        </Suspense>
      </HydrationBoundary>
    </>
  );
}
