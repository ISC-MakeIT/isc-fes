import {
  CartItem,
  MAX_CART_ITEMS_TYPE,
  summarizeCartItems,
  UpdateCartInput,
} from "@/entities/cart";

// トッピングを削除して既存のアイテムと統合され、上限以上の個数になる場合10個に丸める
export function toCartUpdateItems(items: CartItem[]): UpdateCartInput["items"] {
  return summarizeCartItems(items).map(({ item, quantity }) => ({
    id: item.id,
    menuId: item.menuId,
    quantity: Math.min(quantity, MAX_CART_ITEMS_TYPE),
    toppingIds: item.toppings.map((topping) => topping.toppingId),
  }));
}
