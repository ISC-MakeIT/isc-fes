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
import { useEffect, useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { formatYen } from "@/shared/lib/formatYen";
import { CartContents } from "./cart-contents";
import { useCartOperation } from "../model/cart-operation-context";
import { calculateCartTotal } from "../lib/calculate-cart-total";
import { useIsMobile } from "@/shared/lib/hooks";
import { guestStoreDetailParsers } from "@/shared/config";
import { useQueryStates } from "nuqs";
import { cn } from "@/shared/lib/utils";
import { useAppQuestionnaire } from "@/widgets/app-questionnaire";

export function CartList() {
  const [{ isOpenCart }, setSearchParams] = useQueryStates(
    guestStoreDetailParsers,
  );

  const [isSheetOpen, setIsSheetOpen] = useState(isOpenCart);

  const isMobile = useIsMobile();
  const { isQuestionnaireOpen } = useAppQuestionnaire();

  const {
    clearCart,
    displayedCartItems,
    isBusy,
    hasPendingChanges,
    canCheckout,
    checkout,
  } = useCartOperation();

  const totalQuantity = displayedCartItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const totalAmount = calculateCartTotal(displayedCartItems);

  useEffect(() => {
    if (!isOpenCart) {
      return;
    }

    void setSearchParams({ isOpenCart: false }, { history: "replace" });
  }, [isOpenCart, setSearchParams]);

  if (displayedCartItems.length === 0) {
    return null;
  }

  // モーダル同士の重なりとフォーカスの競合を避ける。
  // isSheetOpenは保持し、レビュー送信後にカートシートを再表示する。
  if (isMobile && isQuestionnaireOpen) {
    return null;
  }

  if (isMobile) {
    return (
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <MobileCartBar
          isCheckoutDisabled={isBusy || hasPendingChanges || !canCheckout}
          onCheckout={checkout}
          className={cn(
            "fixed inset-x-0 bottom-0 w-full",
            isSheetOpen ? "z-40" : "z-60",
          )}
        >
          <SheetTrigger className="flex h-20 flex-1 flex-row items-center gap-4">
            <CartSummary
              totalQuantity={totalQuantity}
              totalAmount={totalAmount}
            />
          </SheetTrigger>
        </MobileCartBar>

        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[calc(100dvh-3rem)] gap-0 overflow-hidden rounded-t-2xl"
        >
          <SheetHeader className="bg-cart-sheet-header flex h-10 shrink-0 flex-row items-center justify-between py-0">
            <SheetTitle className="text-sm">カート内の商品</SheetTitle>
            <Button
              type="button"
              variant="ghost"
              className="text-notice text-sm"
              onClick={clearCart}
              disabled={isBusy}
            >
              全て削除
            </Button>
          </SheetHeader>

          <CartContents />

          <MobileCartBar
            isCheckoutDisabled={isBusy || hasPendingChanges || !canCheckout}
            onCheckout={checkout}
          >
            <div className="flex h-20 flex-1 flex-row items-center gap-4">
              <CartSummary
                totalQuantity={totalQuantity}
                totalAmount={totalAmount}
              />
            </div>
          </MobileCartBar>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="shadow-secondary/50 sticky top-0 right-0 min-h-svh w-full self-start shadow-[-4px_0_4px]">
      <header className="bg-cart-sheet-header flex flex-row items-center justify-between px-6 pt-10">
        <h2 className="text-sm">カート内の商品</h2>
        <Button
          type="button"
          variant="ghost"
          className="text-notice text-sm"
          disabled={isBusy}
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

      <div className="px-6 pb-6">
        <Button
          type="button"
          variant="secondary"
          className="w-full rounded-sm px-6 py-2 font-semibold"
          disabled={isBusy || hasPendingChanges || !canCheckout}
          onClick={checkout}
        >
          注文画面へ ＞
        </Button>
      </div>
    </aside>
  );
}

type MobileCartBarProps = {
  children: React.ReactNode;
  isCheckoutDisabled: boolean;
  onCheckout: () => void;
  className?: string;
};

function MobileCartBar({
  children,
  isCheckoutDisabled,
  onCheckout,
  className,
}: MobileCartBarProps) {
  return (
    <div
      className={cn(
        "bg-background shadow-bottom-bar flex h-20 shrink-0 flex-row items-center gap-4 px-6",
        className,
      )}
    >
      {children}

      <Button
        type="button"
        variant="secondary"
        className="h-auto rounded-sm px-6 py-2 text-base font-semibold shadow-none"
        disabled={isCheckoutDisabled}
        onClick={onCheckout}
      >
        注文画面へ ＞
      </Button>
    </div>
  );
}

type CartSummaryProps = {
  totalQuantity: number;
  totalAmount: number;
};

function CartSummary({ totalQuantity, totalAmount }: CartSummaryProps) {
  return (
    <>
      <CartBadge totalQuantity={totalQuantity} />
      <span className="text-xl font-medium">{formatYen(totalAmount)}</span>
    </>
  );
}

type CartBadgeProps = {
  totalQuantity: number;
};

function CartBadge({ totalQuantity }: CartBadgeProps) {
  return (
    <div className="relative">
      <Image
        src={CartIcon}
        alt={"カートのアイコン"}
        className="h-10"
        draggable={false}
      />
      {totalQuantity > 0 && (
        <Badge className="text-foreground bg-cart-quantity-badge absolute top-1 -left-1 z-10 h-5 min-w-5 rounded-full p-0 font-medium">
          {totalQuantity}
        </Badge>
      )}
    </div>
  );
}
