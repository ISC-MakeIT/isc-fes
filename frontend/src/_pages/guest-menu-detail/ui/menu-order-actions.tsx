"use client";

import { MAX_CART_ITEM_QUANTITY } from "@/entities/cart";
import { Menu } from "@/entities/menu";
import { formatYen } from "@/shared/lib/formatYen";
import { Button } from "@/shared/ui/button";
import { QuantityController } from "@/widgets/quantity-controller";

type MenuOrderActionsProps = {
  storeId: string;
  menu: Menu;
  quantity: number;
  isAddingToCart: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
  onAddToCart: () => void;
};
export function MenuOrderActions({
  isAddingToCart,
  menu,
  quantity,
  onDecrease,
  onIncrease,
  onAddToCart,
}: MenuOrderActionsProps) {
  return (
    <div className="bg-background shadow-bottom-bar fixed inset-x-0 bottom-0 z-50 md:static md:shadow-none">
      <div className="flex w-full flex-row justify-between px-10 py-4">
        <span className="text-xl font-semibold">
          {formatYen(menu.unitPrice)}
        </span>
        <QuantityController
          onDecrease={onDecrease}
          onIncrease={onIncrease}
          quantity={quantity}
          isDisabledDecreaseButton={quantity <= 1}
          isDisabledIncreaseButton={quantity >= MAX_CART_ITEM_QUANTITY}
        />
      </div>

      <div className="flex justify-center px-6 py-4">
        <Button
          disabled={isAddingToCart}
          className="h-auto w-full truncate rounded-sm p-2 md:text-xl"
          onClick={onAddToCart}
        >
          カートに入れる
        </Button>
      </div>
    </div>
  );
}
