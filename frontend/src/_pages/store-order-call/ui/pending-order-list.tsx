"use client";

import {
  Order,
  OrderItem,
  OrderStatus,
  storeOrdersQueryOptions,
} from "@/entities/order";
import { Card } from "@/shared/ui/card";
import { SharpCorneredTriangleIcon } from "@/shared/ui/sharp-cornered-triangle-icon";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";

type PendingOrderListProps = {
  storeId: string;
};

export function PendingOrderList({ storeId }: PendingOrderListProps) {
  const { data: pendingOrders } = useSuspenseQuery(
    storeOrdersQueryOptions(storeId, [OrderStatus.Pending]),
  );

  return (
    <ul className="flex flex-col gap-6 px-8 py-6">
      {pendingOrders.map((order) => (
        <PendingOrderRow key={order.id} order={order} />
      ))}
    </ul>
  );
}

type PendingOrderRowProps = {
  order: Order;
};

function PendingOrderRow({ order }: PendingOrderRowProps) {
  return (
    <li>
      <Card className="border-secondary shadow-primary flex flex-row gap-2 rounded-sm border-3 px-6 py-4 shadow-[4px_4px_0]">
        <div className="flex w-full flex-col">
          <div className="border-foreground space-y-1 border-b">
            <h2 className="space-x-2 text-lg font-semibold">
              <span>注文番号</span>
              <span className="text-[1.375rem] font-bold">
                {order.displayNumber}
              </span>
            </h2>
          </div>

          <div className="space-y-4 py-2 pr-2">
            {order.items.map((item) => (
              <OrderItemRow key={item.id} item={item} />
            ))}
          </div>
        </div>

        <SharpCorneredTriangleIcon className="mt-2.5 shrink-0" />
      </Card>
    </li>
  );
}

type OrderItemRowProps = {
  item: OrderItem;
};

function OrderItemRow({ item }: OrderItemRowProps) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-row justify-between">
        <h3 className="font-semibold">{item.menuName}</h3>
        <p className="shrink-0 font-semibold">：{item.quantity}個</p>
      </div>

      {item.toppings.map((topping) => (
        <div key={topping.toppingId} className="flex flex-row gap-2 pt-2 pl-4">
          <PlusIcon className="size-4" />
          {topping.toppingName}
        </div>
      ))}
    </div>
  );
}
