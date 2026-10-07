import { CartItem } from "@/entities/cart";
import { describe, expect, test } from "vitest";
import { decreaseCartItemQuantity } from "./decrease-cart-item-quantity";

function createCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "item-1",
    menuId: "menu-1",
    name: "テスト",
    available: true,
    imageUrl: "/menu.jpg",
    quantity: 2,
    toppings: [],
    unitPrice: 400,
    ...overrides,
  };
}

const cartItems: CartItem[] = [
  createCartItem({ id: "item-1", quantity: 2 }),
  createCartItem({ id: "item-2", quantity: 1 }),
  createCartItem({ id: "item-3", quantity: 0 }),
];

describe("decreaseCartItemQuantity", () => {
  test("数量が2以上なら対象のアイテムの数量を一つ減らす", () => {
    const result = decreaseCartItemQuantity(cartItems, "item-1");

    expect(result.map(({ id, quantity }) => ({ id, quantity }))).toEqual([
      { id: "item-1", quantity: 1 },
      { id: "item-2", quantity: 1 },
      { id: "item-3", quantity: 0 },
    ]);
  });

  test("数量が1以下なら対象のアイテムを削除する", () => {
    const decreaseItem2 = decreaseCartItemQuantity(cartItems, "item-2");
    const result = decreaseCartItemQuantity(decreaseItem2, "item-3");

    expect(result).toEqual([cartItems[0]]);
  });

  test("指定したアイテムが存在しない場合は何も変更しない", () => {
    const result = decreaseCartItemQuantity(cartItems, "hoge");

    expect(result).toBe(cartItems);
  });
});
