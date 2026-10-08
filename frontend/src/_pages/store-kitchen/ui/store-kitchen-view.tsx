"use client";

import { Order, OrderItem, OrderStatus } from "@/entities/order";
import { storeOrdersQueryOptions } from "@/entities/order";
import { Card } from "@/shared/ui/card";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CircleIcon, PlusIcon } from "lucide-react";

type StoreKitchenViewProps = {
  storeId: string;
};

export function StoreKitchenView({ storeId }: StoreKitchenViewProps) {
  const { data: pendingOrders } = useSuspenseQuery({
    ...storeOrdersQueryOptions(storeId),
    select: (orders) =>
      orders.filter((order) => order.status === OrderStatus.Pending),
  });

  return (
    <div className="flex flex-1 items-start gap-8 overflow-x-auto px-8 pt-10">
      {pendingOrders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}

      <div className="absolute right-3 bottom-3 grid grid-cols-[minmax(0,1fr)_5rem] text-[2.5rem] font-bold">
        <p>注文数：</p>
        <p className="text-right">{pendingOrders.length}</p>
      </div>
    </div>
  );
}

type OrderCardProps = {
  order: Order;
};

function OrderCard({ order }: OrderCardProps) {
  return (
    <Card className="border-secondary shadow-primary flex shrink-0 flex-col items-center rounded-md border-4 px-6 pt-4 pb-8 shadow-[4px_4px_0]">
      <CircleIcon size={16} className="text-secondary fill-secondary" />
      <div className="space-y-6">
        <div className="flex flex-row items-center justify-center gap-2">
          <p className="text-lg font-semibold">注文番号</p>
          <p className="text-2xl font-bold">{order.displayNumber}</p>
        </div>
        {order.items.map((item) => (
          <OrderItemRow key={item.id} orderItem={item} />
        ))}
      </div>
    </Card>
  );
}

type OrderItemRowProps = {
  orderItem: OrderItem;
};

function OrderItemRow({ orderItem }: OrderItemRowProps) {
  return (
    <div className="flex flex-row justify-between gap-4 text-2xl font-bold">
      <div className="">
        <span>{orderItem.menuName}</span>
        <div className="flex flex-col">
          {orderItem.toppings.map((topping) => (
            <div
              key={topping.toppingId}
              className="flex flex-row items-center gap-2 pt-2 pl-8 text-lg font-semibold"
            >
              <PlusIcon size={20} />
              <p>{topping.toppingName}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="tabular-nums">：{orderItem.quantity}個</p>
    </div>
  );
}
