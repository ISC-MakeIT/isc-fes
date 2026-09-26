import { Cart, UpdateCartInput } from "@/entities/cart";
import { describe, expect, test } from "vitest";
import { buildCartUpdateInput } from "./build-cart-update-input";

const cart: Cart = {
  storeId: "store-1",
  version: 3,
  totalAmount: 800,
  canCheckout: true,
  items: [
    {
      id: "cart-item-1",
      menuId: "menu-1",
      name: "焼きそば",
      imageUrl: "/yakisoba.jpg",
      available: true,
      quantity: 2,
      unitPrice: 400,
      toppings: [
        {
          id: "cart-item-topping-1",
          cartItemId: "cart-item-1",
          toppingId: "topping-1",
          name: "目玉焼き",
          unitPrice: 100,
          available: true,
        },
      ],
    },
  ],
};

describe("buildCartUpdateInput", () => {
  test("既存の商品をAPI用の形式に変換し、新しい商品を末尾に追加する", () => {
    const result = buildCartUpdateInput({
      cart,
      menuId: "menu-2",
      quantity: 3,
      toppingIds: ["topping-2", "topping-3"],
    });

    expect(result).toEqual({
      expectedVersion: 3,
      items: [
        {
          id: "cart-item-1",
          menuId: "menu-1",
          quantity: 2,
          toppingIds: ["topping-1"],
        },
        {
          menuId: "menu-2",
          quantity: 3,
          toppingIds: ["topping-2", "topping-3"],
        },
      ],
    } satisfies UpdateCartInput);
  });

  test("カートがからの場合は新しい商品のみを返す", () => {
    const emptyCart: Cart = {
      storeId: "store-1",
      version: 0,
      totalAmount: 0,
      canCheckout: false,
      items: [],
    };

    const result = buildCartUpdateInput({
      cart: emptyCart,
      menuId: "menu-1",
      quantity: 1,
      toppingIds: [],
    });

    expect(result).toEqual({
      expectedVersion: 0,
      items: [
        {
          menuId: "menu-1",
          quantity: 1,
          toppingIds: [],
        },
      ],
    } satisfies UpdateCartInput);
  });
});
