import { storeOrdersQueryOptions } from "@/entities/order";
import { createQueryClient } from "@/shared/api";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { PendingOrderList } from "./pending-order-list";

type StoreOrderCallViewProps = {
  storeId: string;
};

export async function StoreOrderCallView({ storeId }: StoreOrderCallViewProps) {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery(storeOrdersQueryOptions(storeId));

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
          <div className="bg-order-ready-background flex-1"></div>
        </section>
      </main>
    </HydrationBoundary>
  );
}
