import { CartItem } from "@/entities/cart";

/**
 * Item[]の合計金額を算出する純粋関数
 * カート内のアイテムを操作中の場合に値段を知りたいときははcart.totalAmountではなくこちらを使用する想定
 * @param items
 * @returns
 */
export function calculateCartTotal(items: CartItem[]): number {
  return items.reduce((cartTotal, item) => {
    const toppingsUnitPrice = item.toppings.reduce(
      (toppingTotal, topping) => toppingTotal + topping.unitPrice,
      0,
    );

    return cartTotal + (item.unitPrice + toppingsUnitPrice) * item.quantity;
  }, 0);
}
