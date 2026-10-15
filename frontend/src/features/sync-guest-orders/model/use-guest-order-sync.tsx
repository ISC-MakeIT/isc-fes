"use client";

import {
  ordersQueryOptions,
  OrderStatus,
  useOrderEvents,
} from "@/entities/order";
import { useQuery } from "@tanstack/react-query";

export function useGuestOrderSync() {
  const { data: orders } = useQuery(
    ordersQueryOptions([OrderStatus.Pending, OrderStatus.Ready]),
  );
  const hasActiveOrders = (orders?.length ?? 0) > 0;

  return useOrderEvents(hasActiveOrders);
}
