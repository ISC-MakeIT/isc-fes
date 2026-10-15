"use client";

import { getApiBaseUrl, ordersKey, websocketOrdersUrl } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { useQueryClient } from "@tanstack/react-query";
import useWebSocket from "react-use-websocket";

const orderNotificationSchema = v.object({
  type: v.picklist(["connection.ready", "orders.changed"]),
});

const closeCode = {
  normal: 1000,
  polictViolation: 1008,
} as const;

export function useOrderEvents(enabled: boolean) {
  const queryClient = useQueryClient();

  const url = new URL(websocketOrdersUrl(), getApiBaseUrl());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  function handleMessage(event: MessageEvent) {
    if (typeof event.data !== "string") {
      return;
    }

    let payload: unknown;

    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }

    const result = v.safeParse(orderNotificationSchema, payload);

    if (!result.success) {
      return;
    }

    queryClient.invalidateQueries({
      queryKey: ordersKey(),
    });
  }

  const { readyState } = useWebSocket(
    url.toString(),
    {
      onMessage: handleMessage,
      shouldReconnect: (event) =>
        event.code !== closeCode.normal &&
        event.code! !== closeCode.polictViolation,
      reconnectAttempts: 10,
      reconnectInterval: (attempt) =>
        Math.min(1000 * 2 ** attempt, 30_000) + Math.random() * 10000,
      heartbeat: false,
    },
    enabled,
  );

  return readyState;
}
