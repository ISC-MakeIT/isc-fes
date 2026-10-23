"use client";

import { CartItem, fetchCartQueryOptions, updateCart } from "@/entities/cart";
import { cartKey, guestCheckoutUrl } from "@/shared/config";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createContext, use, useEffect, useState } from "react";
import { toCartUpdateItems } from "../lib/to-cart-update-items";
import { increaseCartItemQuantity } from "../lib/increase-cart-item-quantity";
import { decreaseCartItemQuantity } from "../lib/decrease-cart-item-quantity";
import { removeCartItem } from "../lib/remove-cart-item";
import { removeCartItemTopping } from "../lib/remove-cart-item-toppings";
import { useDebouncer } from "@tanstack/react-pacer";
import { useRouter } from "next/navigation";
import { fetchCheckoutable } from "../api/fetch-checkoutable";
import { toast } from "@/shared/ui/toast";
import { getCheckoutErrorMessage } from "../lib/get-checkout-error-message";

const CART_UPDATE_DELAY_MS = 1000;

type CartOperationContextValue = {
  increaseItemQuantity: (cartItemId: string) => void;
  decreaseItemQuantity: (cartItemId: string) => void;
  removeItem: (cartItemId: string) => void;
  removeTopping: (cartItemId: string, toppingId: string) => void;
  clearCart: () => void;
  checkout: () => void;
  isBusy: boolean;
  hasPendingChanges: boolean;
  canCheckout: boolean;
  displayedCartItems: CartItem[];
};

const CartOperationContext = createContext<CartOperationContextValue | null>(
  null,
);

type CartOperationProviderProps = {
  storeId: string;
  children: React.ReactNode;
};

export function CartOperationProvider({
  storeId,
  children,
}: CartOperationProviderProps) {
  const queryClient = useQueryClient();
  const { data: fetchedCart } = useSuspenseQuery(
    fetchCartQueryOptions(storeId),
  );

  const [draftCartItems, setDraftCartItems] = useState<CartItem[] | null>(null);

  const displayedCartItems = draftCartItems ?? fetchedCart.items;

  const router = useRouter();

  // チェックアウトできる条件はカート内の全アイテムが売り切れ、または削除されていないこと
  const canCheckout =
    displayedCartItems.length > 0 &&
    displayedCartItems.every(
      (item) =>
        item.available && item.toppings.every((topping) => topping.available),
    );
  function updateDraftCartItems(update: (items: CartItem[]) => CartItem[]) {
    if (isBusy) {
      return;
    }
    setDraftCartItems((currentItems) =>
      update(currentItems ?? fetchedCart.items),
    );
  }

  const updateCartMutation = useMutation({
    mutationFn: updateCart,
    onError: async (error) => {
      toast.add({
        type: "error",
        priority: "high",
        title: "カートを更新できませんでした",
        description: error.message,
      });

      await queryClient.invalidateQueries({
        queryKey: cartKey(storeId),
      });
      setDraftCartItems(null);
    },
    onSuccess: (updatedCart) => {
      queryClient.setQueryData(cartKey(storeId), updatedCart);
      setDraftCartItems(null);
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: (expectedCartVersion: number) =>
      fetchCheckoutable(storeId, expectedCartVersion),

    onSuccess: ({ code }) => {
      if (code) {
        toast.add({
          type: "error",
          title: "注文できませんでした",
          description: getCheckoutErrorMessage(code),
        });
        return;
      }

      router.push(guestCheckoutUrl(storeId));
    },

    onError: () => {
      toast.add({
        type: "error",
        title: "注文できませんでした",
        description: "しばらく時間を置いて再度お試しください",
      });
    },
  });

  const isBusy = checkoutMutation.isPending || updateCartMutation.isPending;

  const cartUpdateDebouncer = useDebouncer(
    async (items: CartItem[]) => {
      await queryClient.cancelQueries({
        queryKey: cartKey(storeId),
      });
      updateCartMutation.mutate({
        storeId,
        previousCart: fetchedCart,
        updateCartInput: {
          expectedVersion: fetchedCart.version,
          items: toCartUpdateItems(items),
        },
      });
    },
    {
      wait: CART_UPDATE_DELAY_MS,
      onUnmount: (debouncer) => {
        debouncer.flush();
      },
    },
  );

  useEffect(() => {
    if (!draftCartItems || updateCartMutation.isPending) {
      return;
    }

    cartUpdateDebouncer.maybeExecute(draftCartItems);

    return () => {
      cartUpdateDebouncer.cancel();
    };
  }, [updateCartMutation.isPending, draftCartItems, storeId]);

  function increaseItemQuantity(cartItemId: string) {
    updateDraftCartItems((items) =>
      increaseCartItemQuantity(items, cartItemId),
    );
  }

  function decreaseItemQuantity(cartItemId: string) {
    updateDraftCartItems((items) =>
      decreaseCartItemQuantity(items, cartItemId),
    );
  }

  function removeItem(cartItemId: string) {
    updateDraftCartItems((items) => removeCartItem(items, cartItemId));
  }

  function removeTopping(cartItemId: string, toppingId: string) {
    updateDraftCartItems((items) =>
      removeCartItemTopping(items, cartItemId, toppingId),
    );
  }

  function clearCart() {
    if (isBusy) {
      return;
    }
    setDraftCartItems([]);
    cartUpdateDebouncer.maybeExecute([]);
    cartUpdateDebouncer.flush();
  }

  function checkout() {
    if (isBusy || draftCartItems !== null || !canCheckout) {
      return;
    }

    checkoutMutation.mutate(fetchedCart.version);
  }

  return (
    <CartOperationContext
      value={{
        increaseItemQuantity,
        decreaseItemQuantity,
        removeItem,
        removeTopping,
        clearCart,
        isBusy,
        hasPendingChanges: !!draftCartItems,
        // チェックアウトできる条件は 売り切れ or 削除済みのアイテムがカートに含まれていないこと
        canCheckout,
        checkout,
        displayedCartItems: displayedCartItems,
      }}
    >
      {children}
    </CartOperationContext>
  );
}

export function useCartOperation() {
  const context = use(CartOperationContext);

  if (!context) {
    throw new Error(
      "useCartOperationはCartOperationProviderの中で使用してください",
    );
  }

  return context;
}
