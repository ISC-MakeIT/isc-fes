import { CartItem } from "@/entities/cart";
import { describe, expect, test } from "vitest";
import { removeCartItem } from "./remove-cart-item";

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
  createCartItem({ id: "item-1" }),
  createCartItem({ id: "item-2" }),
];

describe("removeCartItem", () => {
  test("指定したidのアイテムだけを排除すること", () => {
    const result = removeCartItem(cartItems, "item-1");

    expect(result).toEqual([cartItems[1]]);
  });

  test("存在しないidを指定したら何もしない", () => {
    const result = removeCartItem(cartItems, "hoge");

    expect(result).toEqual(cartItems);
  });
});
