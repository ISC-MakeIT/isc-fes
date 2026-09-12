"use client";

import { fetchStoreOrders, Order } from "@/entities/order";
import { Card } from "@/shared/ui/card";
import { CircleIcon } from "lucide-react";

type StoreKitchenViewProps = {
  storeId: string;
};

export function StoreKitchenView({ storeId }: StoreKitchenViewProps) {
  const orders = fetchStoreOrders({ storeId });
  return (
    <div className="flex flex-1 items-start overflow-x-auto pt-24">
      <div className="flex items-start gap-8 px-8">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}

type OrderCardProps = {
  order: Order;
};

function OrderCard({ order }: OrderCardProps) {
  return (
    <Card className="border-secondary shadow-primary flex flex-col items-center border-4 px-6 pt-6 pb-10 shadow-[4px_4px_0]">
      <CircleIcon size={20} className="text-secondary fill-secondary" />
      <div className="space-y-10">
        <div className="space-y-4 text-center">
          <p className="text-xl font-medium">注文番号</p>
          <p className="text-[2.5rem] font-bold">{order.id}</p>
        </div>
        {order.items.map((item) => (
          <div
            className="grid grid-cols-[12.065rem_5.5rem] text-2xl font-bold"
            key={item.id}
          >
            <span>{item.name}</span>
            <div className="flex justify-between">
              <span>：</span>
              <span className="tabular-nums">{item.quantity}個</span>
            </div>

            <div className="flex flex-col">
              {item.toppings.map((topping) => (
                <p key={topping.id} className="pl-8">
                  {topping.name}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
