import { StoreHomeView } from "@/_pages/store-home";
import { storeMemberQueryOptions } from "@/_pages/store-home/api/fetch-store-members";
import { storeMenusQueryOptions } from "@/entities/menu";
import { storeDetailQueryOptions } from "@/entities/store";
import { createQueryClient } from "@/shared/api";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "店舗ホーム",
};

export default async function StoreHomePage({
  params,
}: PageProps<"/member/stores/[storeId]">) {
  const { storeId } = await params;

  const queryClient = createQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(storeDetailQueryOptions(storeId)),
    queryClient.prefetchQuery(storeMenusQueryOptions(storeId)),
    queryClient.prefetchQuery(storeMemberQueryOptions(storeId)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StoreHomeView storeId={storeId} />;
    </HydrationBoundary>
  );
}
