import { StoreReview } from "./store-review";
import { createQueryClient } from "@/shared/api";
import { storeApplicationQueryOptions } from "../api/fetch-store-applications";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export async function StoreApplicationsView() {
  const queryClient = createQueryClient();
  await queryClient.prefetchQuery(storeApplicationQueryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StoreReview />
    </HydrationBoundary>
  );
}
