import { Order, OrderStatus } from "@/entities/order";
import { DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { PendingOrderItemRow } from "./pending-order-item-row";
import { ActionButton } from "@/shared/ui/action-button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrder } from "../api/update-order";
import { orderDetailKey, storeOrdersKey } from "@/shared/config";
import { toast } from "@/shared/ui/toast";

type OrderCallConfirmDialogProps = {
  order: Order;
};

export function OrderCallConfirmDialog({ order }: OrderCallConfirmDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: updateOrder,
    onSuccess: async (updatedOrder) => {
      const pendingKey = storeOrdersKey(updatedOrder.storeId, [
        OrderStatus.Pending,
      ]);
      const readyKey = storeOrdersKey(updatedOrder.storeId, [
        OrderStatus.Ready,
      ]);

      await Promise.all([
        queryClient.cancelQueries({ queryKey: pendingKey, exact: true }),
        queryClient.invalidateQueries({ queryKey: readyKey, exact: true }),
        queryClient.invalidateQueries({ queryKey: orderDetailKey(order.id) }),
      ]);

      queryClient.setQueryData<Order[]>(pendingKey, (orders) =>
        orders?.filter((order) => order.id !== updatedOrder.id),
      );
    },

    onError: (error) => {
      toast.add({
        type: "error",
        title: "呼び出し処理ができませんでした",
        description: error.message,
      });
    },
  });

  return (
    <DialogContent className="shadow-dialog-primary flex max-h-[calc(100dvh-2rem)] flex-col px-10 pt-14 pb-6 sm:max-w-sm">
      <DialogTitle className="flex shrink-0 flex-row items-center justify-center gap-4 pb-6 text-lg font-semibold">
        <span>注文番号</span>
        <span className="text-2xl font-bold">{order.displayNumber}</span>
        <span>番</span>
      </DialogTitle>

      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        {order.items.map((item) => (
          <PendingOrderItemRow key={item.id} item={item} />
        ))}
      </div>

      {/* TODO: Buttonのvariantのdefaultをprimary色にする */}
      <ActionButton
        className="bg-primary hover:bg-primary/80 mx-auto mt-6 shrink-0 rounded-md px-14 py-4 shadow-none"
        type="button"
        disabled={mutation.isPending}
        onClick={() => {
          mutation.mutate({
            storeId: order.storeId,
            orderId: order.id,
            input: {
              status: OrderStatus.Ready,
              expectedVersion: order.version,
            },
          });
        }}
      >
        呼び出す
      </ActionButton>
    </DialogContent>
  );
}
