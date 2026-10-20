import { OrderStatus, storeOrdersQueryOptions } from "@/entities/order";
import { createQueryClient } from "@/shared/api";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { PendingOrderList } from "./pending-order-list";
import { ReadyOrderList } from "./ready-order-list";
import { StoreCongestionDialog } from "./store-congestion-dialog";

type StoreOrderCallViewProps = {
  storeId: string;
};

export async function StoreOrderCallView({ storeId }: StoreOrderCallViewProps) {
  const queryClient = createQueryClient();

  await Promise.all([
    // 子のquery fetchではPending, Readyそれぞれでfetchしてるので、prefetchも分けないとキャッシュが効かない
    queryClient.prefetchQuery(
      storeOrdersQueryOptions(storeId, [OrderStatus.Pending]),
    ),
    queryClient.prefetchQuery(
      storeOrdersQueryOptions(storeId, [OrderStatus.Ready]),
    ),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="grid flex-1 grid-cols-[minmax(0,389fr)_minmax(0,737fr)]">
        <section className="flex flex-col">
          <h2 className="bg-order-pending-header flex h-18 w-full items-center justify-center text-[1.375rem]">
            準備中の注文番号
          </h2>
          <div className="bg-order-pending-background flex-1">
            <PendingOrderList storeId={storeId} />
          </div>
        </section>
        <section className="flex flex-col">
          <h2 className="bg-order-ready-header flex h-18 w-full items-center justify-center text-[1.375rem]">
            呼び出し中番号
          </h2>
          <div className="bg-order-ready-background flex-1">
            <ReadyOrderList storeId={storeId} />
          </div>
        </section>
      </main>
      <StoreCongestionDialog key={storeId} storeId={storeId} />
    </HydrationBoundary>
  );
}
