"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { fetchOrderByidQueryOptions } from "../api/fetch-order-by-id";
import { OrderStatus } from "@/entities/order";
import { cn } from "@/shared/lib/utils";
import { DotText } from "@/shared/ui/dot-text";

const orderStatusHeaderStyle = {
  [OrderStatus.Pending]: "border-b-[0.125rem] border-secondary",
  [OrderStatus.Ready]: "bg-secondary text-primary-foreground",
  [OrderStatus.Cancelled]: "bg-notice text-primary-foreground",
};

type OrderStatusHeaderProps = {
  orderId: string;
};

export function OrderStatusHeader({ orderId }: OrderStatusHeaderProps) {
  const { data: order } = useSuspenseQuery(fetchOrderByidQueryOptions(orderId));

  if (!order || order.status === OrderStatus.Completed) {
    return null;
  }

  return (
    <div
      className={cn(
        "w-full py-2 text-center text-lg font-bold",
        orderStatusHeaderStyle[order.status],
      )}
    >
      {order.status === OrderStatus.Pending && <DotText>準備中。。。</DotText>}
      {order.status === OrderStatus.Ready && <p>お呼び出し中！！</p>}
      {order.status === OrderStatus.Cancelled && (
        <DotText>ご注文はキャンセルされました</DotText>
      )}
    </div>
  );
}
