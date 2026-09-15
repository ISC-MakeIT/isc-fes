import { createMockOrders } from "../lib/create-mock-orders";
import { Order } from "../model/types";

type FetchStoreOrdersParams = {
  storeId: string;
};

// TODO: 実APIができたらそっちを叩くようにする。
//       けどもしかしたらWebSocketでリアルタイムに取得できるようにするかも？
export function fetchStoreOrders({ storeId }: FetchStoreOrdersParams): Order[] {
  return createMockOrders(storeId);
}
