"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";
import Image from "next/image";
import CartIcon from "./assets/cart-icon.svg";
import { Button } from "@/shared/ui/button";
import { useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { formatYen } from "@/shared/lib/formatYen";
import { CartContents } from "./cart-contents";
import { useCartOperation } from "../model/cart-operation-context";
import { calculateCartTotal } from "../lib/calculate-cart-total";

type CartListProps = {
  storeId: string;
};

export function CartList({ storeId }: CartListProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { clearCart, displayedCartItems, isSaving, hasPendingChanges } =
    useCartOperation();

  const totalQuantity = displayedCartItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const totalAmount = calculateCartTotal(displayedCartItems);

  if (displayedCartItems.length === 0) {
    return null;
  }

  return (
    <>
      {/* モバイル表示 */}
      <div className="lg:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <div className="bg-background shadow-bottom-bar fixed inset-x-0 bottom-0 z-60 flex w-full flex-row items-center gap-4 px-6">
            <SheetTrigger className="flex h-20 flex-1 flex-row items-center gap-4">
              <CartBadge totalQuantity={totalQuantity} />
              <span className="text-xl font-medium">
                {formatYen(totalAmount)}
              </span>
            </SheetTrigger>

            {/* TODO: チェックアウト処理 */}
            <Button
              type="button"
              variant="secondary"
              className="rounded-sm px-6 py-2 font-semibold"
              disabled={isSaving || hasPendingChanges}
            >
              注文画面へ ＞
            </Button>
          </div>

          <SheetContent
            side="bottom"
            showCloseButton={false}

            className="max-h-[calc(100vh-5rem)] gap-0 overflow-hidden rounded-t-2xl data-[side=bottom]:bottom-20"
          >
            <SheetHeader className="bg-cart-sheet-header flex h-10 flex-row items-center justify-between py-0">
              <SheetTitle className="text-sm">カート内の商品</SheetTitle>
              <Button
                type="button"
                variant="ghost"
                disabled={isSaving}
                className="text-notice text-sm"
                onClick={clearCart}
              >
                全て削除
              </Button>
            </SheetHeader>

            <CartContents />
          </SheetContent>
        </Sheet>
      </div>

      {/* PC表示 */}
      <aside className="shadow-secondary/50 hidden min-h-svh shadow-[-4px_0_4px] lg:sticky lg:top-0 lg:right-0 lg:block lg:w-full lg:self-start">
        <header className="bg-cart-sheet-header flex flex-row items-center justify-between px-6 pt-10">
          <h2 className="text-sm">カート内の商品</h2>
          <Button
            type="button"
            variant="ghost"
            disabled={hasPendingChanges}
            className="text-notice text-sm"
            onClick={clearCart}
          >
            全て削除
          </Button>
        </header>
        <CartContents />

        <div className="flex h-20 flex-row items-center justify-center gap-4">
          <CartBadge totalQuantity={totalQuantity} />
          <span className="text-xl font-medium">{formatYen(totalAmount)}</span>
        </div>

        {/* TODO: チェックアウト処理 */}
        <div className="px-6">
          <Button
            type="button"
            variant="secondary"
            className="w-full rounded-sm px-6 py-2 font-semibold"
            disabled={isSaving || hasPendingChanges}
          >
            注文画面へ ＞
          </Button>
        </div>
      </aside>
    </>
  );
}

type CartBadgeProps = {
  totalQuantity: number;
};

function CartBadge({ totalQuantity }: CartBadgeProps) {
  return (
    <div className="relative">
      <Image src={CartIcon} alt={"カートのアイコン"} className="h-10" />
      {totalQuantity > 0 && (
        <Badge className="text-foreground bg-cart-quantity-badge absolute top-1 -left-1 z-10 h-5 min-w-5 rounded-full p-0 font-medium">
          {totalQuantity}
        </Badge>
      )}
    </div>
  );
}
