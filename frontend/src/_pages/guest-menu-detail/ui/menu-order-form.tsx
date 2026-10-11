"use client";

import { Menu } from "@/entities/menu";
import { useState } from "react";
import { MenuOrderActions } from "./menu-order-actions";
import { ToppingSelector } from "./topping-selector";
import { v } from "@/shared/lib/valibot";
import {
  CartItemQuantity,
  fetchCartQueryOptions,
  MAX_CART_ITEMS_TYPE,
  summarizeCartItems,
  updateCart,
} from "@/entities/cart";
import { buildCartUpdateInput } from "../lib/build-cart-update-input";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { cartKey, guestStoreDetailUrl } from "@/shared/config";
import { useRouter } from "next/navigation";
import { createCartItemIdentityKey } from "@/entities/cart";

type MenuOrderFormProps = {
  storeId: string;
  menu: Menu;
};

export function MenuOrderForm({ storeId, menu }: MenuOrderFormProps) {
  const router = useRouter();

  const [quantity, setQuantity] = useState(1);
  const [selectedToppingIds, setSelectedToppingIds] = useState<string[]>([]);

  const queryClient = useQueryClient();

  const { data: cart } = useSuspenseQuery(fetchCartQueryOptions(storeId));

  const groupedItems = summarizeCartItems(cart.items);

  const selectedItemIdentityKey = createCartItemIdentityKey({
    menuId: menu.id,
    toppingIds: selectedToppingIds,
  });

  const isSelectedItemAlreadyInCart = groupedItems.some(({ item }) => {
    const cartItemIdentityKey = createCartItemIdentityKey({
      menuId: item.menuId,
      toppingIds: item.toppings.map((topping) => topping.toppingId),
    });

    return cartItemIdentityKey === selectedItemIdentityKey;
  });

  const isCartItemLimitReached =
    groupedItems.length >= MAX_CART_ITEMS_TYPE && !isSelectedItemAlreadyInCart;

  // NOTE:
  //  カート追加時のエラーはここではあえて処理しない。注文確認前にエラー処理を集約させる。
  //  売り切れ済みのアイテムなどキャッシュ次第でカートに入りうる & ここではエラーをどこに出すのかが難しい
  const updateCartMutation = useMutation({
    mutationFn: updateCart,
    onError: async () => {
      await queryClient.invalidateQueries({
        queryKey: cartKey(storeId),
      });
    },
    onSuccess: (updatedCart) => {
      queryClient.setQueryData(cartKey(storeId), updatedCart);
      router.push(
        guestStoreDetailUrl(storeId, {
          isOpenCart: true,
        }),
      );
    },
  });

  function changeQuantity(amount: -1 | 1) {
    setQuantity((currentQuantity) => {
      const result = v.safeParse(CartItemQuantity, currentQuantity + amount);

      return result.success ? result.output : currentQuantity;
    });
  }

  function handleAddToCart() {
    const updateCartInput = buildCartUpdateInput({
      cart,
      menuId: menu.id,
      quantity,
      toppingIds: selectedToppingIds,
    });

    updateCartMutation.mutate({
      storeId,
      updateCartInput,
    });
  }

  return (
    <div className="md:border-primary/50 flex flex-col md:border-l-2">
      <ToppingSelector
        storeId={storeId}
        menuId={menu.id}
        onValueChange={setSelectedToppingIds}
        value={selectedToppingIds}
      />
      <MenuOrderActions
        isAddingToCart={updateCartMutation.isPending}
        isCartItemLimitReached={isCartItemLimitReached}
        storeId={storeId}
        menu={menu}
        quantity={quantity}
        onDecrease={() => changeQuantity(-1)}
        onIncrease={() => changeQuantity(1)}
        onAddToCart={() => handleAddToCart()}
      />
    </div>
  );
}
