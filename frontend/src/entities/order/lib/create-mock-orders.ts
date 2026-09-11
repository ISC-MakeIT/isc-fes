import { Order, OrderStatus } from "../model/types";

/**
 * TODO: オーダーのモックデータを生成してくれる関数。バックエンドができ次第廃棄予定
 * @param storeId
 * @returns
 */
export function createMockOrders(storeId: string): Order[] {
  return [
    {
      id: `${storeId}-order-1`,
      storeId,
      status: OrderStatus.Placed,
      items: [
        {
          id: `${storeId}-order-1-item-1`,
          name: "たこ焼き",
          toppings: [],
        },
      ],
    },
    {
      id: `${storeId}-order-2`,
      storeId,
      status: OrderStatus.Placed,
      items: [
        {
          id: `${storeId}-order-2-item-1`,
          name: "焼きそば",
          toppings: [
            {
              id: `${storeId}-order-2-item-1-topping-1`,
              name: "目玉焼き",
            },
          ],
        },
        {
          id: `${storeId}-order-2-item-2`,
          name: "カレー",
          toppings: [
            {
              id: `${storeId}-order-2-item-2-topping-1`,
              name: "チーズ",
            },
            {
              id: `${storeId}-order-2-item-2-topping-2`,
              name: "温泉卵",
            },
          ],
        },
      ],
    },
    {
      id: `${storeId}-order-3`,
      storeId,
      status: OrderStatus.Cooked,
      items: [
        {
          id: `${storeId}-order-3-item-1`,
          name: "フランクフルト",
          toppings: [
            {
              id: `${storeId}-order-3-item-1-topping-1`,
              name: "ケチャップ",
            },
            {
              id: `${storeId}-order-3-item-1-topping-2`,
              name: "マスタード",
            },
          ],
        },
      ],
    },
    {
      id: `${storeId}-order-4`,
      storeId,
      status: OrderStatus.PickedUp,
      items: [
        {
          id: `${storeId}-order-4-item-1`,
          name: "唐揚げ",
          toppings: [
            {
              id: `${storeId}-order-4-item-1-topping-1`,
              name: "レモン",
            },
          ],
        },
      ],
    },
  ];
}
