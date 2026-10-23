import { OrderEventsSubscriber } from "@/entities/order";
import { canAccessStore } from "@/features/store-access";
import { createQueryClient } from "@/shared/api";
import { HeadingCard } from "@/shared/ui/heading-card";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { fetchOrderByidQueryOptions } from "../api/fetch-order-by-id";
import { OrderNavigation } from "./order-navigation";
import { OrderStatusHeader } from "./order-status-header";
import { PickupQuestionnaire } from "./pickup-questionnaire";
import { Receipt } from "./receipt";
import { Ticket } from "./ticket";

type OrderDetailViewProps = {
  orderId: string;
};

export async function OrderDetailView({ orderId }: OrderDetailViewProps) {
  const queryClient = createQueryClient();
  const order = await queryClient.fetchQuery(
    fetchOrderByidQueryOptions(orderId),
  );

  if (!order) {
    notFound();
  }

  const canContinueOrdering = await canAccessStore(order.storeId);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrderEventsSubscriber />
      <PickupQuestionnaire orderId={orderId} />
      <OrderStatusHeader orderId={orderId} />
      <main className="mx-auto flex max-w-150 flex-col items-center gap-4 p-8 pb-16">
        <HeadingCard className="px-14 py-2 text-[1.375rem]">
          注文完了
        </HeadingCard>

        <p className="font-semibold">
          こちらの画面は、商品受け取り時に店員に提示してください。
        </p>

        <div className="relative flex w-fit flex-col items-center pb-46 lg:flex lg:flex-row lg:pb-0">
          <Receipt orderId={orderId} />

          <div className="absolute bottom-3 lg:-top-1 lg:-right-70">
            <Ticket orderId={orderId} />
          </div>
        </div>

        <OrderNavigation
          canContinueOrdering={canContinueOrdering}
          storeId={order.storeId}
        />
      </main>
    </HydrationBoundary>
  );
}
