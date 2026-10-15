"use client";

import { useQuery } from "@tanstack/react-query";
import { useGuestOrderSync } from "../model/use-guest-order-sync";
import { Order, ordersQueryOptions, OrderStatus } from "@/entities/order";
import { Card } from "@/shared/ui/card";
import Link from "next/link";
import { orderDetailUrl } from "@/shared/config";
import { cn } from "@/shared/lib/utils";

export function ActiveOrderList() {
  useGuestOrderSync();

  const { data: activeOrders } = useQuery(
    ordersQueryOptions([OrderStatus.Pending, OrderStatus.Ready]),
  );

  if (!activeOrders) return;

  return (
    <div className="absolute inset-x-0 top-0 z-10 flex flex-col gap-4 px-6 pt-4">
      {activeOrders.map((order) => (
        <ActiveOrderRow key={order.id} order={order} />
      ))}
    </div>
  );
}

type ActiveOrderRowProps = {
  order: Pick<Order, "storeName" | "status" | "id">;
};

function ActiveOrderRow({ order }: ActiveOrderRowProps) {
  const isReady = order.status === OrderStatus.Ready;
  return (
    <Link href={orderDetailUrl(order.id)}>
      <Card
        className={cn(
          "border-tertiary grid grid-cols-[minmax(0,1fr)_auto_7.5rem] items-center justify-end gap-5 rounded-sm border-2 px-4 py-2",
          isReady && "bg-tertiary text-primary-foreground",
        )}
      >
        <p className="truncate">{order.storeName}</p>
        <p className="text-xl font-semibold">：</p>
        <p className="shrink-0 text-center text-xl font-semibold">
          {isReady ? "お呼び出し中" : "準備中"}
        </p>
      </Card>
    </Link>
  );
}
