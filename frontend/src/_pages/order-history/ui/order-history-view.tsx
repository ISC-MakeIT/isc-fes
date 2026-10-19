import { ordersQueryOptions } from "@/entities/order";
import { createQueryClient } from "@/shared/api";
import { HeadingCard } from "@/shared/ui/heading-card";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { OrderList } from "./order-list";
import { LinkButton } from "@/shared/ui/link-button";
import { ChevronLeftIcon } from "lucide-react";
import { homeUrl } from "@/shared/config";

export async function OrderHistoryView() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery(ordersQueryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="mx-auto flex flex-col items-center md:max-w-150">
        <section className="p-8">
          <HeadingCard className="px-14 py-2">注文履歴</HeadingCard>
        </section>
        <OrderList />
        <section className="px-4 pt-8 pb-16">
          <LinkButton
            href={homeUrl()}
            className="px-14 py-2 text-[1.375rem] font-bold md:py-4"
          >
            <ChevronLeftIcon className="size-8" /> トップに戻る
          </LinkButton>
        </section>
      </main>
    </HydrationBoundary>
  );
}
