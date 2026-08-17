import { ErrorBoundary } from "react-error-boundary";
import { storeDetailQueryOptions } from "../api/fetch-store-detail";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { StoreInfo } from "./store-detail";
import { createQueryClient } from "@/shared/api";

type StoreHomeViewProps = { storeId: string };

export async function StoreHomeView({ storeId }: StoreHomeViewProps) {
  const queryClient = createQueryClient();
  await queryClient.prefetchQuery(storeDetailQueryOptions(storeId));
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ErrorBoundary fallback={<p>エラーが発生しました</p>}>
        <Suspense fallback={<p>ロード中</p>}>
          <StoreInfo storeId={storeId} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
