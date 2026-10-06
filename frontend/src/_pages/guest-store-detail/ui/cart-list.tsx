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
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  fetchCartQueryOptions,
  summarizeCartItems,
  updateCart,
} from "@/entities/cart";
import { useState } from "react";
import { cartKey, MENU_IMAGE_ASPECT } from "@/shared/config";
import { Badge } from "@/shared/ui/badge";
import { buildClearCartInput } from "../lib/build-clear-cart-input";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { formatYen } from "@/shared/lib/formatYen";
import { CornerLeftUpIcon, XIcon } from "lucide-react";
import { QuantityController } from "@/widgets/quantity-controller";
import { SoldOutLabel } from "@/entities/menu";

type CartListProps = {
  storeId: string;
};

export function CartList({ storeId }: CartListProps) {
  const queryClient = useQueryClient();
  const { data: cart } = useSuspenseQuery(fetchCartQueryOptions(storeId));

  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const summarizedItems = summarizeCartItems(cart.items);
  const totalQuantity = summarizedItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const clearCartMutation = useMutation({
    mutationFn: updateCart,
    onError: async () => {
      await queryClient.invalidateQueries({
        queryKey: cartKey(storeId),
      });
    },
    onSuccess: (updatedCart) => {
      queryClient.setQueryData(cartKey(storeId), updatedCart);
      setIsSheetOpen(false);
    },
  });

  if (summarizedItems.length === 0) {
    return null;
  }

  return (
    <>
      {/* モバイル表示 */}
      <div className="lg:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <div className="bg-background shadow-bottom-bar fixed inset-x-0 bottom-0 z-60 flex w-full flex-row items-center gap-4 px-6">
            <SheetTrigger className="flex h-20 flex-1 flex-row items-center gap-4">
              <div className="relative">
                <Image
                  src={CartIcon}
                  alt={"カートのアイコン"}
                  className="h-10"
                />
                {totalQuantity > 0 && (
                  <Badge className="text-foreground bg-cart-quantity-badge absolute top-1 -left-1 z-10 size-5 rounded-full p-0 font-medium">
                    {totalQuantity}
                  </Badge>
                )}
              </div>
              <span className="text-xl font-medium">
                {formatYen(cart.totalAmount)}
              </span>
            </SheetTrigger>

            {/* TODO: チェックアウト処理 */}
            <Button
              type="button"
              variant="secondary"
              className="rounded-sm px-6 py-2 font-semibold"
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
                disabled={clearCartMutation.isPending}
                className="text-notice text-sm"
                onClick={() =>
                  clearCartMutation.mutate({
                    storeId,
                    updateCartInput: buildClearCartInput(cart),
                  })
                }
              >
                全て削除
              </Button>
            </SheetHeader>

            <CartContents storeId={storeId} />
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
            disabled={clearCartMutation.isPending}
            className="text-notice text-sm"
            onClick={() =>
              clearCartMutation.mutate({
                storeId,
                updateCartInput: buildClearCartInput(cart),
              })
            }
          >
            全て削除
          </Button>
        </header>
        <CartContents storeId={storeId} />

        <div className="flex h-20 flex-row items-center justify-center gap-4">
          <div className="relative">
            <Image src={CartIcon} alt={"カートのアイコン"} className="h-10" />
            {totalQuantity > 0 && (
              <Badge className="text-foreground bg-cart-quantity-badge absolute top-1 -left-1 z-10 size-5 rounded-full p-0 font-medium">
                {totalQuantity}
              </Badge>
            )}
          </div>
          <span className="text-xl font-medium">
            {formatYen(cart.totalAmount)}
          </span>
        </div>

        {/* TODO: チェックアウト処理 */}
        <div className="px-6">
          <Button
            type="button"
            variant="secondary"
            className="w-full rounded-sm px-6 py-2 font-semibold"
          >
            注文画面へ ＞
          </Button>
        </div>
      </aside>
    </>
  );
}

type CartContentsProps = {
  storeId: string;
};

export function CartContents({ storeId }: CartContentsProps) {
  const { data: cart } = useSuspenseQuery(fetchCartQueryOptions(storeId));

  return (
    <ul className="flex flex-col overflow-y-auto">
      {cart.items.map((item) => (
        <li
          key={item.id}
          className="border-foreground relative flex flex-col gap-2 border-b px-6 py-4"
        >
          {!item.available && (
            <div className="bg-soldout-overlay absolute inset-0 z-10 flex flex-col items-center justify-center">
              <div className="flex flex-col gap-2">
                <Image src={SoldOutLabel} alt="" className="w-60" />
                <p className="text-xs">
                  こちらの商品は只今売り切れとなりました。
                </p>
              </div>
              <Button
                variant="ghost"
                className="text-notice text-xs font-bold underline underline-offset-2"
              >
                削除する
              </Button>
            </div>
          )}

          <div className="border-foreground flex flex-row gap-6 border-b border-dashed py-2">
            <AspectRatioImage
              alt={`${item.name}の画像`}
              src={item.imageUrl}
              ratio={MENU_IMAGE_ASPECT}
              className="w-25 shrink-0 rounded-sm"
            />
            <p className="line-clamp-3 text-xl font-semibold">{item.name}</p>
          </div>

          {item.toppings.map((topping) => (
            <div
              key={topping.id}
              className="border-foreground flex min-h-13.75 flex-row gap-2 border-b border-dashed py-2 pl-20"
            >
              <CornerLeftUpIcon size={15} className="shrink-0 justify-start" />
              <p className="line-clamp-2 font-semibold">{topping.name}</p>
              <Button
                type="button"
                variant="ghost"
                className="text-notice ml-auto px-2"
              >
                <XIcon size={10} strokeWidth={3} />
              </Button>
            </div>
          ))}

          <div className="flex h-11 flex-row items-center justify-between text-lg font-medium">
            <p className="w-18">{formatYen(item.unitPrice)}</p>
            {/* TODO: 個数変更処理 */}
            <QuantityController
              onDecrease={() => {}}
              onIncrease={() => {}}
              quantity={item.quantity}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
