import { PendingOrderList } from "./pending-order-list";
import { ReadyOrderList } from "./ready-order-list";

type PickupDisplayViewProps = {
  storeId: string;
};

export function PickupDisplayView({ storeId }: PickupDisplayViewProps) {
  return (
    <main className="flex flex-1 flex-col">
      <div className="grid grid-cols-[minmax(0,389fr)_minmax(0,737fr)]">
        <h2 className="bg-order-pending-header flex h-18 w-full items-center justify-center text-xl font-semibold">
          準備中の注文番号
        </h2>
        <h1 className="bg-order-ready-header flex h-18 w-full items-center justify-center text-[2rem]">
          呼び出し中番号
        </h1>
      </div>
      <div className="grid flex-1 grid-cols-[minmax(0,389fr)_minmax(0,737fr)]">
        <PendingOrderList storeId={storeId} />
        <ReadyOrderList storeId={storeId} />
      </div>
    </main>
  );
}
