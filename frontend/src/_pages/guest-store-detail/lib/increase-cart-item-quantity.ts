import { CartItem, MAX_CART_ITEM_QUANTITY } from "@/entities/cart";

/**
 * 指定されたアイテムの個数を+1にして返す純粋関数
 * @param items
 * @param cartItemId
 * @returns
 */
export function increaseCartItemQuantity(
  items: CartItem[],
  cartItemId: string,
): CartItem[] {
  const targetItem = items.find((item) => item.id === cartItemId);

  if (!targetItem || targetItem.quantity >= MAX_CART_ITEM_QUANTITY) {
    return items;
  }

  return items.map((item) => {
    {
      if (item.id !== cartItemId) {
        return item;
      }

      return {
        ...item,
        quantity: item.quantity + 1,
      };
    }
  });
}
