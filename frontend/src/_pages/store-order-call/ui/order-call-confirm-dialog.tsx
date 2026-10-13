import { Order } from "@/entities/order";
import { DialogContent } from "@/shared/ui/dialog";
import { PendingOrderItemRow } from "./pending-order-item-row";
import { ActionButton } from "@/shared/ui/action-button";

type OrderCallConfirmDialogProps = {
  order: Order;
};

export function OrderCallConfirmDialog({ order }: OrderCallConfirmDialogProps) {
  return (
    <DialogContent className="shadow-dialog-primary flex flex-col px-10 pt-14 pb-6 sm:max-w-sm">
      <div>
        <h2 className="flex flex-row items-center justify-center gap-4 pb-6 text-lg font-semibold">
          <span>注文番号</span>
          <span className="text-2xl font-bold">{order.displayNumber}</span>
          <span>番</span>
        </h2>

        <div className="flex flex-col gap-4">
          {order.items.map((item) => (
            <PendingOrderItemRow key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* TODO: Buttonのvariantのdefaultをprimary色にする */}
      <ActionButton className="bg-primary hover:bg-primary/80 mx-auto mt-6 rounded-md px-14 py-4 shadow-none">
        呼び出す
      </ActionButton>
    </DialogContent>
  );
}
