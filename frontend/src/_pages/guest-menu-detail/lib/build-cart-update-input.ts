import {
  Cart,
  createCartItemIdentityKey,
  MAX_CART_ITEM_QUANTITY,
  summarizeCartItems,
  UpdateCartInput,
} from "@/entities/cart";

type BuildCartUpdateInputParams = {
  cart: Cart;
  quantity: number;
  menuId: string;
  toppingIds: string[];
};

/**
 * 既存のカートに新しいアイテムを追加して、カート更新APIに送れるデータへ変換する純粋関数
 * もしカートに同じ内容のアイテムがあれば統合
 * （マッチしたアイテムが複数あれば、先に見つけたitem.idへ統合）
 * @param param0
 * @returns UpdateCartInput
 */
export function buildCartUpdateInput({
  cart,
  quantity,
  menuId,
  toppingIds,
}: BuildCartUpdateInputParams): UpdateCartInput {
  const selectedItemIdentityKey = createCartItemIdentityKey({
    menuId,
    toppingIds,
  });

  const summarizedItems = summarizeCartItems(cart.items);

  const hasSelectedItem = summarizedItems.some(({ item }) => {
    return (
      createCartItemIdentityKey({
        menuId: item.menuId,
        toppingIds: item.toppings.map((topping) => topping.toppingId),
      }) === selectedItemIdentityKey
    );
  });

  const existingItems = summarizedItems.map(
    ({ item, quantity: currentQuantity }) => {
      const itemIdentityKey = createCartItemIdentityKey({
        menuId: item.menuId,
        toppingIds: item.toppings.map((topping) => topping.toppingId),
      });

      const nextQuantity =
        itemIdentityKey === selectedItemIdentityKey
          ? currentQuantity + quantity
          : currentQuantity;

      return {
        id: item.id,
        menuId: item.menuId,
        quantity: Math.min(nextQuantity, MAX_CART_ITEM_QUANTITY),
        toppingIds: item.toppings.map((topping) => topping.toppingId),
      };
    },
  );

  return {
    expectedVersion: cart.version,
    items: hasSelectedItem
      ? existingItems
      : [
          ...existingItems,
          {
            menuId,
            quantity,
            toppingIds,
          },
        ],
  };
}
