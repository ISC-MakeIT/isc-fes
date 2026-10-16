"use client";

import {
  getApiBaseUrl,
  orderDetailKeys,
  ordersKey,
  Sentry,
  websocketOrdersUrl,
} from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import useWebSocket from "react-use-websocket";
import { Order, OrderStatus } from "./types";

const orderNotificationSchema = v.variant("type", [
  v.object({
    type: v.literal("connection.ready"),
    data: v.object({
      orders: v.array(Order),
    }),
  }),
  v.object({
    type: v.literal("orders.changed"),
    data: v.object({
      orders: v.array(Order),
      changedOrderId: v.string(),
    }),
  }),
]);

const closeCode = {
  normal: 1000,
  policyViolation: 1008,
} as const;

export function useOrderEvents(enabled: boolean) {
  const queryClient = useQueryClient();

  const url = new URL(websocketOrdersUrl(), getApiBaseUrl());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  async function handleMessage(event: MessageEvent) {
    try {
      const notification = v.parse(
        orderNotificationSchema,
        JSON.parse(event.data),
      );

      if (notification.type === "orders.changed") {
        await Promise.all([
          updateOrderList(queryClient, notification.data.orders),
          invalidateOrderDetail(queryClient, notification.data.changedOrderId),
        ]);
      }

      if (notification.type === "connection.ready") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orderDetailKeys.all() }),
          updateOrderList(queryClient, notification.data.orders),
        ]);
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          source: "order-websocket",
        },
      });
    }
  }

  const { readyState } = useWebSocket(
    url.toString(),
    {
      onMessage: handleMessage,
      shouldReconnect: (event) =>
        event.code !== closeCode.normal &&
        event.code !== closeCode.policyViolation,
      // NOTE:
      // - 再接続は最大10回
      // - 待機時間は接続回数分2乗していく。
      // - サーバー復旧時の全ユーザー同時再接続を防ぐ為、0〜10秒のランダムな時間も加える
      reconnectAttempts: 10,
      reconnectInterval: (attempt) =>
        Math.min(1000 * 2 ** attempt, 30_000) + Math.random() * 10000,
      heartbeat: false,
    },
    enabled,
  );

  return readyState;
}

async function updateOrderList(queryClient: QueryClient, orders: Order[]) {
  const statusesList = [
    [OrderStatus.Pending],
    [OrderStatus.Ready],
    [OrderStatus.Pending, OrderStatus.Ready],
  ];

  await Promise.all(
    statusesList.map(async (statuses) => {
      const queryKey = ordersKey(statuses);

      await queryClient.cancelQueries({ queryKey });

      queryClient.setQueryData(
        queryKey,
        orders.filter((order) => statuses.includes(order.status)),
      );
    }),
  );
}

async function invalidateOrderDetail(
  queryClient: QueryClient,
  changedOrderId: string,
) {
  await queryClient.invalidateQueries({
    queryKey: orderDetailKeys.detail(changedOrderId),
    exact: true,
  });
}
