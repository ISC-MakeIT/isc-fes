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
  orderDetailKeys,
  orderDetailUrl,
} from "@/shared/config";
import { useRouter } from "next/navigation";
import { toast } from "@/shared/ui/toast";
import { LinkButton } from "@/shared/ui/link-button";
import { Dialog, DialogTrigger } from "@/shared/ui/dialog";
import { useState } from "react";
import { OrderConfirmDialog } from "./order-confirm-dialog";
import {
  hasConfirmedOrderNotice,
  storeOrderNoticeConfirmation,
} from "../lib/order-notice-storage";

type CartListProps = {
  storeId: string;
};

export function CartList({ storeId }: CartListProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: cart } = useSuspenseQuery(fetchCartQueryOptions(storeId));
  const summarisedItems = summarizeCartItems(cart.items);

  const router = useRouter();

  const mutation = useMutation({
    mutationFn: createOrder,

    onSuccess: async (order) => {
      queryClient.setQueryData(orderDetailKeys.detail(order.id), order);

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

  function submitOrder() {
    if (mutation.isPending) {
      return;
    }

    storeOrderNoticeConfirmation();
    mutation.mutate({
      storeId,
      expectedCartVersion: cart.version,
    });
  }

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

      <div className="flex flex-row items-center justify-center gap-6 px-6 pt-8 pb-18">
        <LinkButton
          href={guestStoreDetailUrl(storeId)}
          aria-label="店舗に戻る"
          className="shrink-0 justify-self-end px-6 py-2 md:hidden"
        >
          <ChevronLeftIcon className="size-8" />
        </LinkButton>

        <Dialog
          open={isConfirmOpen}
          onOpenChange={(open) => {
            if (mutation.isPending) {
              return;
            }

            if (open && hasConfirmedOrderNotice()) {
              submitOrder();
              return;
            }

            setIsConfirmOpen(open);
          }}
        >
          <DialogTrigger
            disabled={mutation.isPending}
            render={
              <ActionButton
                className="flex-1 py-2 text-[1.375rem] font-bold md:flex-0 md:px-14"
                isDot={false}
              />
            }
          >
            注文する
          </DialogTrigger>
          <OrderConfirmDialog
            isPending={mutation.isPending}
            onConfirm={submitOrder}
          />
        </Dialog>
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
