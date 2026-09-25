import { storeDetailQueryOptions } from "@/entities/store";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { StoreInfo } from "./store-info";
import { createQueryClient } from "@/shared/api";
import { StoreMenuList } from "./store-menu-list";
import { StoreMembersSection } from "./store-member-section";
import { storeMenusQueryOptions } from "@/entities/menu";
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
      </HydrationBoundary>
    </>
  );
}
