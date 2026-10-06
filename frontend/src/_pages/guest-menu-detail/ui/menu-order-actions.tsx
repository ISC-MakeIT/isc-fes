"use client";

import { MAX_CART_ITEMS_TYPE } from "@/entities/cart";
import { Menu } from "@/entities/menu";
import { formatYen } from "@/shared/lib/formatYen";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { QuantityController } from "@/widgets/quantity-controller";
import { useState } from "react";

type MenuOrderActionsProps = {
  storeId: string;
  menu: Menu;
  quantity: number;
  isAddingToCart: boolean;
  isCartItemLimitReached: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
  onAddToCart: () => void;
};
export function MenuOrderActions({
  isAddingToCart,
  isCartItemLimitReached,
  menu,
  quantity,
  onDecrease,
  onIncrease,
  onAddToCart,
}: MenuOrderActionsProps) {
  const [isLimitTooltipOpen, setIsLimitTooltipOpen] = useState(false);

  const isAddToCartDisabled = isAddingToCart || isCartItemLimitReached;

  return (
    <div className="bg-background shadow-bottom-bar fixed inset-x-0 bottom-0 md:static md:shadow-none">
      <div className="flex w-full flex-row justify-between px-10 py-4">
        <span className="text-xl font-semibold">
          {formatYen(menu.unitPrice)}
        </span>
        <QuantityController
          onDecrease={onDecrease}
          onIncrease={onIncrease}
          quantity={quantity}
        />
      </div>

      <div className="flex justify-center px-6 py-4">
        <Tooltip
          disabled={!isCartItemLimitReached}
          open={isCartItemLimitReached && isLimitTooltipOpen}
          onOpenChange={setIsLimitTooltipOpen}
        >
          <TooltipTrigger
            render={
              <span
                className="w-full"
                tabIndex={isCartItemLimitReached ? 0 : undefined}
                onClick={() => {
                  if (isCartItemLimitReached) {
                    setIsLimitTooltipOpen(true);
                  }
                }}
              />
            }
          >
            <Button
              disabled={isAddToCartDisabled}
              className="h-auto w-full truncate rounded-sm p-2 md:text-xl"
              onClick={onAddToCart}
            >
              カートに入れる
            </Button>
          </TooltipTrigger>

          <TooltipContent>
            カートに入れられるメニューは{MAX_CART_ITEMS_TYPE}種類までです。
            <br />
            注文を分けてください。
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
