import { CartItem, summarizeCartItems, UpdateCartInput } from "@/entities/cart";

// トッピングを削除して既存のアイテムと統合され、上限以上の個数になる場合
// カートに入るのは許容して、チェックアウトはできないようにする
export function toCartUpdateItems(items: CartItem[]): UpdateCartInput["items"] {
  return summarizeCartItems(items).map(({ item, quantity }) => ({
    id: item.id,
    menuId: item.menuId,
    quantity,
    toppingIds: item.toppings.map((topping) => topping.toppingId),
  }));
}
