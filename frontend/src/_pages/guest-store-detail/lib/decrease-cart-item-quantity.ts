import { CartItem } from "@/entities/cart";

/**
 * 指定されたアイテムの個数を-1にして返す純粋関数
 * @param items
 * @param cartItemId
 * @returns
 */
export function decreaseCartItemQuantity(
  items: CartItem[],
  cartItemId: string,
): CartItem[] {
  const targetItem = items.find((item) => item.id === cartItemId);

  if (!targetItem) {
    return items;
  }

  if (targetItem.quantity <= 1) {
    return items.filter((item) => item.id !== targetItem.id);
  }

  return items.map((item) => {
    {
      if (item.id !== cartItemId) {
        return item;
      }

      return {
        ...item,
        quantity: item.quantity - 1,
      };
    }
  });
}
