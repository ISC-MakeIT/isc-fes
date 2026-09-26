"use client";

import { CartItemQuantity } from "@/entities/cart";
import { Menu } from "@/entities/menu";
import { formatYen } from "@/shared/lib/formatYen";
import { v } from "@/shared/lib/valibot";
import { Button } from "@/shared/ui/button";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

type MenuOrderActionsProps = {
  storeId: string;
  menu: Menu;
};
export function MenuOrderActions({ menu }: MenuOrderActionsProps) {
  const [quantity, setQuantity] = useState(1);

  function changeQuantity(amount: -1 | 1) {
    setQuantity((currentValue) => {
      const result = v.safeParse(CartItemQuantity, currentValue + amount);
      return result.success ? result.output : currentValue;
    });
  }

  return (
    <div className="bg-background shadow-foreground/25 md:border-primary/50 fixed inset-x-0 bottom-0 shadow-[0_-4px_4px] md:static md:border-t-2 md:shadow-none">
      <div className="flex w-full flex-row justify-between px-10 py-4">
        <span className="text-xl font-semibold">
          {formatYen(menu.unitPrice)}
        </span>
        <div className="flex min-w-35.75 flex-row items-center justify-between">
          <Button
            onClick={() => changeQuantity(-1)}
            aria-label="数量を減らす"
            variant="tertiary"
            size="icon-xs"
            className="rounded-full"
          >
            <MinusIcon />
          </Button>
          <span className="text-xl font-semibold">{quantity}</span>
          <Button
            variant="tertiary"
            size="icon-xs"
            aria-label="数量を増やす"
            onClick={() => changeQuantity(1)}
            className="rounded-full"
          >
            <PlusIcon aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(2,minmax(0,11rem))] justify-between gap-[1.94rem] px-6 py-4">
        <Button
          variant="outline"
          className="border-secondary h-auto min-w-0 truncate rounded-sm p-2 md:text-xl"
        >
          注文に進む
        </Button>
        <Button className="h-auto min-w-0 truncate rounded-sm p-2 md:text-xl">
          カートに入れる
        </Button>
      </div>
    </div>
  );
}
