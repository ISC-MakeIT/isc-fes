import { CartItemSummary } from "../model/cart-item-summary";
import { CartItem } from "../model/types";

function createCartItemIdentityKey(item: CartItem): string {
  const sortedToppingIds = item.toppings
    .map((topping) => topping.toppingId)
    .sort();

  return JSON.stringify([item.menuId, sortedToppingIds]);
}

/**
 * カート内の同一のメニュー、カスタマイズのItemをグルーピングした上で返す純粋関数
 * メニューが同じでトッピングの並び順が違っていても内容が同じであれば同一と判断する
 * @param items
 * @returns
 */
export function summarizeCartItems(items: CartItem[]): CartItemSummary[] {
  const summariseByIdentity = new Map<string, CartItemSummary>();

  for (const item of items) {
    const identityKey = createCartItemIdentityKey(item);
    const existingSummary = summariseByIdentity.get(identityKey);

    if (!existingSummary) {
      summariseByIdentity.set(identityKey, {
        item: item,
        quantity: item.quantity,
      });
      continue;
    }

    summariseByIdentity.set(identityKey, {
      ...existingSummary,
      quantity: existingSummary.quantity + item.quantity,
    });
  }

  return [...summariseByIdentity.values()];
}
