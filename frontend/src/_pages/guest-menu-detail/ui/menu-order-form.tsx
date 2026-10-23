"use client";

import { Menu } from "@/entities/menu";
import { startTransition, useState } from "react";
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
import { useIsStoreMemberOrAdmin } from "@/features/store-access";
import { toast } from "@/shared/ui/toast";
import { storeDetailQueryOptions } from "@/entities/store";
import {
  QuestionnaireTrigger,
  useAppQuestionnaire,
} from "@/widgets/app-questionnaire";

type MenuOrderFormProps = {
  storeId: string;
  menu: Menu;
};

export function MenuOrderForm({ storeId, menu }: MenuOrderFormProps) {
  const router = useRouter();
  const { requestQuestionnaire } = useAppQuestionnaire();

  const [quantity, setQuantity] = useState(1);
  const [selectedToppingIds, setSelectedToppingIds] = useState<string[]>([]);

  const queryClient = useQueryClient();

  const { data: cart } = useSuspenseQuery(fetchCartQueryOptions(storeId));
  const { data: store } = useSuspenseQuery(storeDetailQueryOptions(storeId));

  const canBypassMobileOrderRestriction = useIsStoreMemberOrAdmin(storeId);
  const canMobileOrder = canBypassMobileOrderRestriction || store.orderEnabled;

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

  const updateCartMutation = useMutation({
    mutationFn: updateCart,
    onError: async (error) => {
      // TODO: canCheckoutの詳細がフロントで知れるようになったら、より詳細なエラーメッセージを表示させる
      toast.add({
        type: "error",
        priority: "high",
        title: "カートに追加できませんでした",
        description: error.message,
      });

      await queryClient.invalidateQueries({
        queryKey: cartKey(storeId),
      });
    },
    onSuccess: (updatedCart) => {
      queryClient.setQueryData(cartKey(storeId), updatedCart);
      // 遷移先のカートとアンケートを同じ画面更新で表示する。
      startTransition(() => {
        router.push(
          guestStoreDetailUrl(storeId, {
            isOpenCart: true,
          }),
        );
        requestQuestionnaire(QuestionnaireTrigger.CartItemAdded);
      });
    },
  });

  function changeQuantity(amount: -1 | 1) {
    setQuantity((currentQuantity) => {
      const result = v.safeParse(CartItemQuantity, currentQuantity + amount);

      return result.success ? result.output : currentQuantity;
    });
  }

  function handleAddToCart() {
    if (isCartItemLimitReached) {
      toast.add({
        type: "error",
        priority: "high",
        title: "カートに追加できません",
        description: `カートにいれられるメニューは${MAX_CART_ITEMS_TYPE}種類までです。注文を分けてください`,
      });

      return;
    }

    const updateCartInput = buildCartUpdateInput({
      cart,
      menuId: menu.id,
      quantity,
      toppingIds: selectedToppingIds,
    });

    updateCartMutation.mutate({
      storeId,
      previousCart: cart,
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

      {canMobileOrder && (
        <MenuOrderActions
          isAddingToCart={updateCartMutation.isPending}
          storeId={storeId}
          menu={menu}
          quantity={quantity}
          onDecrease={() => changeQuantity(-1)}
          onIncrease={() => changeQuantity(1)}
          onAddToCart={() => handleAddToCart()}
        />
      )}
    </div>
  );
}
