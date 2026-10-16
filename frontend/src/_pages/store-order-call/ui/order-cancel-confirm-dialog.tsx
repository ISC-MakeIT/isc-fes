import { Order, OrderStatus } from "@/entities/order";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrder } from "../api/update-order";
import { orderDetailKeys, storeOrdersKey } from "@/shared/config";
import { toast } from "@/shared/ui/toast";
import {
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";
import { ActionButton } from "@/shared/ui/action-button";

type OrderCancelConfirmDialogProps = {
  order: Order;
};

export function OrderCancelConfirmDialog({
  order,
}: OrderCancelConfirmDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: updateOrder,
    onSuccess: async (updatedOrder) => {
      const readyKey = storeOrdersKey(updatedOrder.storeId, [
        OrderStatus.Ready,
      ]);
      const cancelledKey = storeOrdersKey(updatedOrder.storeId, [
        OrderStatus.Cancelled,
      ]);

      await Promise.all([
        queryClient.cancelQueries({ queryKey: readyKey, exact: true }),
        queryClient.invalidateQueries({ queryKey: cancelledKey, exact: true }),
        queryClient.invalidateQueries({
          queryKey: orderDetailKeys.detail(order.id),
        }),
      ]);

      queryClient.setQueryData<Order[]>(readyKey, (orders) =>
        orders?.filter((order) => order.id !== updatedOrder.id),
      );
    },

    onError: (error) => {
      toast.add({
        type: "error",
        title: "注文を削除できませんでした",
        description: error.message,
      });
    },
  });

  return (
    <DialogContent className="shadow-dialog-primary flex w-auto flex-col items-center justify-center p-8 pt-18 text-center">
      <DialogTitle className="border-foreground shrink-0 items-center justify-center gap-4 px-4 text-xl font-semibold">
        注文番号
        <span className="mx-2 text-3xl font-bold">{order.displayNumber}</span>
        番の
        <br />
        注文をキャンセルしますか？
      </DialogTitle>

      <DialogDescription>
        キャンセルしたお客様が来た場合、
        <br />
        もう一度ご注文をお願いしてください。
      </DialogDescription>

      <ActionButton
        type="button"
        variant="destructive"
        disabled={mutation.isPending}
        className="mx-auto mt-6 shrink-0 px-14 py-3 text-xl shadow-none"
        onClick={() => {
          mutation.mutate({
            storeId: order.storeId,
            orderId: order.id,
            input: {
              status: OrderStatus.Cancelled,
              expectedVersion: order.version,
            },
          });
        }}
      >
        キャンセルする
      </ActionButton>
    </DialogContent>
  );
}
