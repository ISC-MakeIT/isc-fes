import { CartItem } from "@/entities/cart";

/**
 * 指定されたアイテムのトッピングを排除した配列を返す純粋関数
 * @param items
 * @param cartItemId
 * @param toppingId
 * @returns
 */
export function removeCartItemTopping(
  items: CartItem[],
  cartItemId: string,
  toppingId: string,
): CartItem[] {
  const targetItem = items.find((item) => item.id === cartItemId);
  const hasTargetTopping = targetItem?.toppings.some(
    (topping) => topping.toppingId === toppingId,
  );

  if (!hasTargetTopping) {
    return items;
  }

  return items.map((item) => {
    if (item.id !== cartItemId) {
      return item;
    }

    return {
      ...item,
      toppings: item.toppings.filter(
        (topping) => topping.toppingId !== toppingId,
      ),
    };
  });
}
