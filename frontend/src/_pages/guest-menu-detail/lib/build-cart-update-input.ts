import { Cart, UpdateCartInput } from "@/entities/cart";

type BuildCartUpdateInputParams = {
  cart: Cart;
  quantity: number;
  menuId: string;
  toppingIds: string[];
};

/**
 * 既存のカートに新しいアイテムを追加して、カート更新APIに送れるデータへ変換する純粋関数
 * @param param0
 * @returns UpdateCartInput
 */
export function buildCartUpdateInput({
  cart,
  quantity,
  menuId,
  toppingIds,
}: BuildCartUpdateInputParams): UpdateCartInput {
  const existingItems = cart.items.map((item) => ({
    id: item.id,
    menuId: item.menuId,
    quantity: item.quantity,
    toppingIds: item.toppings.map((topping) => topping.toppingId),
  }));

  return {
    expectedVersion: cart.version,
    items: [
      ...existingItems,
      {
        menuId,
        quantity,
        toppingIds,
      },
    ],
  };
}
