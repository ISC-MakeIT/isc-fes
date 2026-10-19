"use client";
import { Order, ordersQueryOptions, OrderStatus } from "@/entities/order";
import { orderDetailUrl } from "@/shared/config";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import { useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";

const orderStatusPriority = {
  [OrderStatus.Pending]: 0,
  [OrderStatus.Ready]: 1,
  [OrderStatus.Completed]: 2,
  [OrderStatus.Cancelled]: 3,
};

export function OrderList() {
  const { data: orders } = useSuspenseQuery({
    ...ordersQueryOptions(),
    select: (orders) =>
      [...orders].sort(
        (a, b) => orderStatusPriority[a.status] - orderStatusPriority[b.status],
      ),
  });

  return (
    <section className="flex w-full flex-col gap-4 px-4">
      {orders.map((order) => (
        <OrderRow key={order.id} order={order} />
      ))}
    </section>
  );
}

type OrderRowProps = {
  order: Order;
};

function OrderRow({ order }: OrderRowProps) {
  const orderClasses = {
    [OrderStatus.Pending]: "border-primary border",
    [OrderStatus.Ready]: "bg-notice text-primary-foreground",
    [OrderStatus.Completed]:
      "text-order-status-foreground bg-order-closed-background",
    [OrderStatus.Cancelled]:
      "text-order-status-foreground bg-order-closed-background",
  } satisfies Record<OrderStatus, string>;

  return (
    <Link key={order.id} href={orderDetailUrl(order.id)}>
      <Card
        className={cn(
          "w-full rounded-md px-6 py-2 text-xl font-semibold",
          orderClasses[order.status],
        )}
      >
        <p>{order.storeName}</p>
      </Card>
    </Link>
  );
}
