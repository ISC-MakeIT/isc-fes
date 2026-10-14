"use client";

import { Order, OrderStatus, storeOrdersQueryOptions } from "@/entities/order";
import { Card } from "@/shared/ui/card";
import { useSuspenseQuery } from "@tanstack/react-query";
import { buttonVariants } from "@/shared/ui/button";
import { XIcon } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import { useLimitedOpenItems } from "../model/use-limited-open-items";
import { formatYen } from "@/shared/lib/formatYen";
import { ReadyOrderItemRow } from "./ready-order-item-row";
import { Dialog, DialogTrigger } from "@/shared/ui/dialog";
import { OrderPaymentConfirmDialog } from "./order-payment-confirm-dialog";
import { cn } from "@/shared/lib/utils";
import { OrderCancelConfirmDialog } from "./order-cancel-confirm-dialog";
import { useCurrentTime } from "../model/use-current-time";
import { Temporal } from "temporal-polyfill-lite";
import { canCancelOrder } from "../lib/can-cancel-order";

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

  const now = useCurrentTime();

  return (
    <Accordion
      className="flex flex-col gap-6 px-8 py-6"
      multiple
      value={accordionValue}
      onValueChange={accordionOnValueChange}
    >
      {readyOrders.map((order) => (
        <ReadyOrderRow key={order.id} order={order} now={now} />
      ))}
    </Accordion>
  );
}

type ReadyOrderRowProps = {
  order: Order;
  now: Temporal.Instant | null;
};

function ReadyOrderRow({ order, now }: ReadyOrderRowProps) {
  const canCancel = now !== null && canCancelOrder(order, now);

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

          <AccordionContent className="border-foreground space-y-4 border-t py-2 pr-2 pl-8.5">
            {order.items.map((item) => (
              <ReadyOrderItemRow key={item.id} item={item} />
            ))}
          </AccordionContent>
        </div>

        <div className="flex flex-row items-start justify-start gap-4">
          <Dialog>
            <DialogTrigger
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "h-auto rounded-sm px-6 py-1 text-xl font-bold",
              )}
            >
              決済完了
            </DialogTrigger>

            <OrderPaymentConfirmDialog order={order} />
          </Dialog>

          <Dialog>
            <DialogTrigger className="cursor-pointer" disabled={!canCancel}>
              <XIcon className="text-close-button size-7" strokeWidth="4" />
            </DialogTrigger>

            <OrderCancelConfirmDialog order={order} />
          </Dialog>
        </div>
      </Card>
    </AccordionItem>
  );
}
