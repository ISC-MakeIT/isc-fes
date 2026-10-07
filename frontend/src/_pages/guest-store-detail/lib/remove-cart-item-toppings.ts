import { CartItem } from "@/entities/cart";

/**
 * 指定されたアイテムのトッピングを排除した配列を返す純粋関数
 * @param items
 * @param cartItemId
 * @param toppingId
 * @returns
 */
export function removeCartItemToppnig(
  items: CartItem[],
  cartItemId: string,
  toppingId: string,
): CartItem[] {
  const targetItem = items.find((item) => item.id === cartItemId);
  const hasTargetTopping = targetItem?.toppings.some(
    (topping) => topping.id === toppingId,
  );

  if (!hasTargetTopping) {
    return items;
  }

  return items.map((item) => ({
    ...item,
    toppings: item.toppings.filter(
      (topping) => topping.toppingId !== toppingId,
    ),
  }));
}
