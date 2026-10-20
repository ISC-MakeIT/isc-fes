"use client";

import { OrderStatus, storeOrdersQueryOptions } from "@/entities/order";
import { Card } from "@/shared/ui/card";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const PAGE_SIZE = 10;
const PAGE_INTERVAL_MS = 8_000;

type ReadyOrderListProps = {
  storeId: string;
};

export function ReadyOrderList({ storeId }: ReadyOrderListProps) {
  const { data: orders } = useSuspenseQuery(
    storeOrdersQueryOptions(storeId, [OrderStatus.Ready]),
  );

  const [pageIndex, setPageIndex] = useState(0);

  const pageCount = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const currentPageIndex = Math.min(pageIndex, pageCount - 1);

  useEffect(() => {
    if (pageCount <= 1) {
      return;
    }

    const intervalId = setInterval(() => {
      setPageIndex((previousPageIndex) => {
        const validPageIndex = Math.min(previousPageIndex, pageCount - 1);
        return (validPageIndex + 1) % pageCount;
      });
    }, PAGE_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [pageCount]);

  // 注文が減って消えたページを選択したままにしない
  if (pageIndex !== currentPageIndex) {
    setPageIndex(currentPageIndex);
  }

  const startIndex = currentPageIndex * PAGE_SIZE;
  const visibleOrders = orders.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="bg-order-ready-background relative grid grid-flow-col grid-cols-2 grid-rows-5 gap-x-14 gap-y-10 px-20 py-6">
      {visibleOrders.map((order) => (
        <Card
          key={order.id}
          className="shadow-tertiary border-foreground flex items-center justify-center rounded-sm border px-4 py-2 text-center text-[4.5rem] font-semibold shadow-[4px_4px_0]"
        >
          {order.displayNumber}
        </Card>
      ))}

      {pageCount > 1 && (
        <div className="absolute right-2 bottom-0">
          <p className="text-2xl font-semibold">
            <span>{pageIndex + 1}</span>
            <span> / </span>
            <span>{pageCount}</span>
          </p>
        </div>
      )}
    </div>
  );
}
