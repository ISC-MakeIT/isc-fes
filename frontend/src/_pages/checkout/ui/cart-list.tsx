"use client";

import {
  CartItemSummary,
  fetchCartQueryOptions,
  summarizeCartItems,
} from "@/entities/cart";
import { formatYen } from "@/shared/lib/formatYen";
import { ActionButton } from "@/shared/ui/action-button";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { ChevronLeftIcon, PlusIcon } from "lucide-react";
import { createOrder } from "../api/create-order";
import {
  cartKey,
  guestStoreDetailUrl,
  orderDetailKey,
  orderDetailUrl,
} from "@/shared/config";
import { useRouter } from "next/navigation";
import { toast } from "@/shared/ui/toast";
import { LinkButton } from "@/shared/ui/link-button";

type CartListProps = {
  storeId: string;
};

export function CartList({ storeId }: CartListProps) {
  const queryClient = useQueryClient();
  const { data: cart } = useSuspenseQuery(fetchCartQueryOptions(storeId));
  const summarisedItems = summarizeCartItems(cart.items);

  const router = useRouter();

  const mutation = useMutation({
    mutationFn: createOrder,

    onSuccess: async (order) => {
      queryClient.setQueryData(orderDetailKey(order.id), order);

      await queryClient.invalidateQueries({
        queryKey: cartKey(storeId),
        refetchType: "none",
      });

      router.replace(orderDetailUrl(order.id));
    },

    onError: (error) => {
      toast.add({
        type: "error",
        title: "注文できませんでした",
        description: error.message,
      });
    },
  });

  return (
    <div className="flex flex-col justify-center">
      <div className="space-y-[2.31rem] px-6 py-8">
        <ul>
          {summarisedItems.map((summarisedItem) => (
            <CartItemRow
              key={summarisedItem.identityKey}
              summarisedItem={summarisedItem}
            />
          ))}
        </ul>
        <p className="text-right text-[1.375rem] font-bold">
          合計金額　{formatYen(cart.totalAmount)}
        </p>
      </div>

      <div className="mt-8 mb-18 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6">
        <LinkButton
          href={guestStoreDetailUrl(storeId)}
          className="justify-self-end px-6 py-2"
        >
          <ChevronLeftIcon className="size-8" />
        </LinkButton>

        <ActionButton
          className="px-14 py-2 text-[1.375rem] font-bold"
          isDot={false}
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({ storeId, expectedCartVersion: cart.version })
          }
        >
          注文する
        </ActionButton>
      </div>
    </div>
  );
}

type CartItemRowProps = {
  summarisedItem: CartItemSummary;
};

function CartItemRow({ summarisedItem }: CartItemRowProps) {
  const item = summarisedItem.item;
  const unitPriceWithTopping =
    item.unitPrice +
    item.toppings.reduce((total, topping) => total + topping.unitPrice, 0);

  return (
    <li className="border-foreground flex flex-col gap-4 border-b py-4">
      <div>
        <p className="text-lg font-semibold">{item.name}</p>
        {item.toppings.map((topping) => (
          <div
            key={topping.id}
            className="flex items-center gap-2 pt-2 pl-10 font-semibold"
          >
            <PlusIcon size={20} className="shrink-0" />
            <p>{topping.name}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-row justify-end gap-6 text-right text-lg font-medium">
        <div className="flex flex-row gap-2">
          <span>{formatYen(unitPriceWithTopping)}</span>
          <span>×</span>
          <span>{summarisedItem.quantity}</span>
        </div>

        <p className="text-lg font-medium">
          {formatYen(unitPriceWithTopping * summarisedItem.quantity)}
        </p>
      </div>
    </li>
  );
}
