"use client";

import { useOrderEvents } from "../model/use-order-events";

/**
 * web socketに接続してオーダーを購読するためのコンポーネント
 * @returns
 */
export function OrderEventsSubscriber() {
  useOrderEvents(true);

  return null;
}
