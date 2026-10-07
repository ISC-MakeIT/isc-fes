"use client";

import { CartItem, fetchCartQueryOptions, updateCart } from "@/entities/cart";
import { cartKey } from "@/shared/config";
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
import { removeCartItemToppnig } from "../lib/remove-cart-item-toppings";
import { ErrorDialog } from "../ui/error-dialog";

const CART_UPDATE_DELAY_MS = 1000;

type CartOperationContextValue = {
  increaseItemQuantity: (cartItemId: string) => void;
  decreaseItemQuantity: (cartItemId: string) => void;
  removeItem: (cartItemId: string) => void;
  removeTopping: (cartItemId: string, toppingId: string) => void;
  clearCart: () => void;
  isSaving: boolean;
  hasPendingChanges: boolean;
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

  function updateDraftCartItems(update: (items: CartItem[]) => CartItem[]) {
    setDraftCartItems((currentItems) =>
      update(currentItems ?? fetchedCart.items),
    );
  }

  const mutation = useMutation({
    mutationFn: updateCart,
    onError: async () => {
      await queryClient.invalidateQueries({
        queryKey: cartKey(storeId),
      });
    },
    onSuccess: (updatedCart) => {
      queryClient.setQueryData(cartKey(storeId), updatedCart);
      setDraftCartItems(null);
    },
  });

  useEffect(() => {
    if (!draftCartItems || mutation.isPending) {
      return;
    }

    const timeoutId = setTimeout(() => {
      mutation.mutate({
        storeId,
        updateCartInput: {
          expectedVersion: fetchedCart.version,
          items: toCartUpdateItems(draftCartItems),
        },
      });
    }, CART_UPDATE_DELAY_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [mutation.isPending, draftCartItems, storeId]);

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
      removeCartItemToppnig(items, cartItemId, toppingId),
    );
  }

  function clearCart() {
    mutation.mutate({
      storeId,
      updateCartInput: {
        expectedVersion: fetchedCart.version,
        items: [],
      },
    });
  }

  return (
    <CartOperationContext
      value={{
        increaseItemQuantity,
        decreaseItemQuantity,
        removeItem,
        removeTopping,
        clearCart,
        isSaving: mutation.isPending,
        hasPendingChanges: !!draftCartItems,
        displayedCartItems: displayedCartItems,
      }}
    >
      {mutation.isError && <ErrorDialog message={mutation.error.message} />}
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
