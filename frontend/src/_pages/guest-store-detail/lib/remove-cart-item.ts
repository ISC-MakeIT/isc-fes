import { CartItem } from "@/entities/cart";

/**
 * 指定されたアイテムを排除した配列を返す純粋関数
 * @param items
 * @param cartItemId
 * @returns
 */
export function removeCartItem(
  items: CartItem[],
  cartItemId: string,
): CartItem[] {
  return items.filter((item) => item.id !== cartItemId);
}
