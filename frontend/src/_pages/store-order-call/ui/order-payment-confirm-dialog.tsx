import { Order, OrderStatus } from "@/entities/order";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrder } from "../api/update-order";
import { orderDetailKey, storeOrdersKey } from "@/shared/config";
import { toast } from "@/shared/ui/toast";
import { DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { ReadyOrderItemRow } from "./ready-order-item-row";
import { formatYen } from "@/shared/lib/formatYen";
import { ActionButton } from "@/shared/ui/action-button";

type OrderPaymentConfirmDialogProps = {
  order: Order;
};

export function OrderPaymentConfirmDialog({
  order,
}: OrderPaymentConfirmDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: updateOrder,
    onSuccess: async (updatedOrder) => {
      const readyKey = storeOrdersKey(updatedOrder.storeId, [
        OrderStatus.Ready,
      ]);
      const completedKey = storeOrdersKey(updatedOrder.storeId, [
        OrderStatus.Completed,
      ]);

      await Promise.all([
        queryClient.cancelQueries({ queryKey: readyKey, exact: true }),
        queryClient.invalidateQueries({ queryKey: completedKey, exact: true }),
        queryClient.invalidateQueries({ queryKey: orderDetailKey(order.id) }),
      ]);

      queryClient.setQueryData<Order[]>(readyKey, (orders) =>
        orders?.filter((order) => order.id !== updatedOrder.id),
      );
    },

    onError: (error) => {
      toast.add({
        type: "error",
        title: "決済処理ができませんでした",
        description: error.message,
      });
    },
  });

  return (
    <DialogContent className="shadow-dialog-primary flex max-h-[calc(100dvh-2rem)] flex-col px-14 pt-14 pb-6 sm:max-w-xl">
      <DialogTitle className="border-foreground mx-auto flex shrink-0 flex-row items-center justify-center gap-4 border-b px-4 text-lg font-semibold">
        <span>注文番号</span>
        <span className="text-2xl font-bold">{order.displayNumber}</span>
        <span>番</span>
      </DialogTitle>

      <div className="flex min-h-0 flex-col gap-2 pt-4 pr-4 pl-9">
        <div className="border-foreground flex flex-col gap-2 overflow-y-auto border-b">
          {order.items.map((item) => (
            <ReadyOrderItemRow key={item.id} item={item} />
          ))}
        </div>
        <p className="ml-auto shrink-0 text-xl font-semibold">
          合計金額：{formatYen(order.totalAmount)}
        </p>
      </div>

      <ActionButton
        type="button"
        variant="tertiary"
        disabled={mutation.isPending}
        className="mx-auto shrink-0 px-14 py-3 text-xl shadow-none"
        onClick={() => {
          mutation.mutate({
            storeId: order.storeId,
            orderId: order.id,
            input: {
              status: OrderStatus.Completed,
              expectedVersion: order.version,
            },
          });
        }}
      >
        決済完了
      </ActionButton>
    </DialogContent>
  );
}
