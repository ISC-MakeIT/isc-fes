"use client";

import {
  OrderStatus,
  storeOrdersQueryOptions,
  useStoreOrdersFetchErrorToast,
} from "@/entities/order";
import { Card } from "@/shared/ui/card";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const PAGE_SIZE = 16;
const PAGE_INTERVAL_MS = 8_000;

type PendingOrdersProps = {
  storeId: string;
};

export function PendingOrderList({ storeId }: PendingOrdersProps) {
  const { data: orders, isError } = useSuspenseQuery(
    storeOrdersQueryOptions(storeId, [OrderStatus.Pending]),
  );
  useStoreOrdersFetchErrorToast(isError);

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
    <div className="relative grid grid-flow-col grid-cols-2 grid-rows-8 gap-y-6 pt-6 pb-8">
      {visibleOrders.map((order) => (
        <Card
          key={order.id}
          className="shadow-secondary border-foreground mx-[13.5px] flex items-center justify-center rounded-sm border px-4 py-2 text-center text-[40px] font-semibold shadow-[4px_4px_0]"
        >
          {order.displayNumber}
        </Card>
      ))}

      {pageCount > 1 && (
        <div className="absolute right-0 bottom-0">
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
