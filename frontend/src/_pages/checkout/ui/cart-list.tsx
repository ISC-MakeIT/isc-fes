"use client";

import {
  CartItemSummary,
  fetchCartQueryOptions,
  summarizeCartItems,
} from "@/entities/cart";
import { formatYen } from "@/shared/lib/formatYen";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";

type CartListProps = {
  storeId: string;
};

export function CartList({ storeId }: CartListProps) {
  const { data: cart } = useSuspenseQuery(fetchCartQueryOptions(storeId));
  const summarisedItems = summarizeCartItems(cart.items);
  return (
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
    <li className="border-foreground grid grid-cols-[minmax(0,1fr)_3.8125rem] items-end gap-6 border-b py-4">
      <div>
        <p className="text-lg font-semibold">{item.name}</p>
        {item.toppings.map((topping) => (
          <div
            key={topping.id}
            className="flex items-center gap-2 pt-2 pl-10 font-semibold"
          >
            <PlusIcon size={20} />
            <p>{topping.name}</p>
          </div>
        ))}

        <div className="flex flex-row items-center justify-end gap-2 text-right text-lg font-medium">
          <span>{formatYen(unitPriceWithTopping)}</span>
          <span>×</span>
          <span>{summarisedItem.quantity}</span>
        </div>
      </div>

      <p className="ml-auto text-lg font-medium">
        {formatYen(unitPriceWithTopping * summarisedItem.quantity)}
      </p>
    </li>
  );
}
