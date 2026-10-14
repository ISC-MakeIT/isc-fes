"use client";

import {
  Order,
  OrderItem,
  OrderStatus,
  storeOrdersQueryOptions,
} from "@/entities/order";
import { Card } from "@/shared/ui/card";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { PlusIcon, XIcon } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import { useLimitedOpenItems } from "../model/use-limited-open-items";
import { formatYen } from "@/shared/lib/formatYen";

const MAX_OPEN_ORDERS = 3;

type ReadyOrderListProps = {
  storeId: string;
};

export function ReadyOrderList({ storeId }: ReadyOrderListProps) {
  const { data: readyOrders } = useSuspenseQuery(
    storeOrdersQueryOptions(storeId, [OrderStatus.Ready]),
  );

  const [accordionValue, accordionOnValueChange] = useLimitedOpenItems(
    readyOrders.map((order) => order.id),
    MAX_OPEN_ORDERS,
  );

  return (
    <Accordion
      className="flex flex-col gap-6 px-8 py-6"
      multiple
      value={accordionValue}
      onValueChange={accordionOnValueChange}
    >
      {readyOrders.map((order) => (
        <ReadyOrderRow key={order.id} order={order} />
      ))}
    </Accordion>
  );
}

type ReadyOrderRowProps = {
  order: Order;
};

function ReadyOrderRow({ order }: ReadyOrderRowProps) {
  return (
    <AccordionItem value={order.id}>
      <Card className="border-primary flex flex-row gap-4 rounded-sm border-4 px-4">
        <div className="flex w-full flex-col">
          <AccordionTrigger className="flex flex-row gap-4 pb-3">
            <h2 className="space-x-2 text-lg font-semibold">
              <span>注文番号</span>
              <span className="text-[1.375rem] font-bold">
                {order.displayNumber}
              </span>
            </h2>
            <h2 className="mr-10 ml-auto text-[1.375rem] font-bold">{`合計金額：${formatYen(order.totalAmount)}`}</h2>
          </AccordionTrigger>

          <AccordionContent className="border-foreground space-y-4 border-t py-2 pr-2">
            {order.items.map((item) => (
              <OrderItemRow key={item.id} item={item} />
            ))}
          </AccordionContent>
        </div>

        <div className="flex flex-row items-start justify-start gap-4">
          <Button
            variant="secondary"
            className="h-auto rounded-sm px-6 py-1 text-xl font-bold"
          >
            決済完了
          </Button>

          <Button variant="ghost">
            <XIcon className="text-close-button size-7" strokeWidth="4" />
          </Button>
        </div>
      </Card>
    </AccordionItem>
  );
}

type OrderItemRowProps = {
  item: OrderItem;
};

function OrderItemRow({ item }: OrderItemRowProps) {
  const unitPriceWithToppings =
    item.unitPrice +
    item.toppings.reduce((total, topping) => total + topping.unitPrice, 0);

  const itemTotalAmount = unitPriceWithToppings * item.quantity;

  return (
    <div className="border-foreground ml-8.5 flex flex-col gap-2 border-b pb-2">
      <div>
        <h3 className="font-semibold">{item.menuName}</h3>
        {item.toppings.map((topping) => (
          <p
            key={topping.toppingId}
            className="flex flex-row gap-2 pt-1 pl-4 text-sm"
          >
            <PlusIcon className="size-4.5 shrink-0" />
            <span>{topping.toppingName}</span>
          </p>
        ))}
      </div>
      <div className="mr-5 ml-auto flex flex-row gap-4 font-semibold">
        <p className="space-x-1">
          <span>{unitPriceWithToppings}</span>
          <span>×</span>
          <span>{item.quantity}</span>
        </p>
        <p>{formatYen(itemTotalAmount)}</p>
      </div>
    </div>
  );
}
