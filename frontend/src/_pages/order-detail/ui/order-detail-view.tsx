import { homeUrl } from "@/shared/config";
import { HeadingCard } from "@/shared/ui/heading-card";
import { LinkButton } from "@/shared/ui/link-button";
import { Receipt } from "./receipt";
import { createQueryClient } from "@/shared/api";
import { fetchOrderByidQueryOptions } from "../api/fetch-order-by-id";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

type OrderDetailViewProps = {
  orderId: string;
};

export async function OrderDetailView({ orderId }: OrderDetailViewProps) {
  const queryClient = createQueryClient();
  await queryClient.prefetchQuery(fetchOrderByidQueryOptions(orderId));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="flex flex-col items-center gap-4 p-8 pb-16">
        <HeadingCard className="px-14 py-2 text-[1.375rem]">
          注文完了
        </HeadingCard>

        <p className="font-semibold">
          こちらの画面は、商品受け取り時
          <br />
          に店員に提示してください。
        </p>

        <Receipt orderId={orderId} />

        <LinkButton
          href={homeUrl()}
          className="px-14 py-2 text-[1.375rem] font-bold"
        >
          ＜ トップに戻る
        </LinkButton>
      </main>
    </HydrationBoundary>
  );
}
