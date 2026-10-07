"use client";

import { SoldOutLabel } from "@/entities/menu";
import { MENU_IMAGE_ASPECT } from "@/shared/config";
import { formatYen } from "@/shared/lib/formatYen";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { Button } from "@/shared/ui/button";
import { QuantityController } from "@/widgets/quantity-controller";
import { CornerLeftUpIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useCartOperation } from "../model/cart-operation-context";

export function CartContents() {
  const {
    increaseItemQuantity,
    decreaseItemQuantity,
    displayedCartItems,
    removeItem,
    removeTopping,
  } = useCartOperation();

  return (
    <ul className="flex flex-col overflow-y-auto">
      {displayedCartItems.map((item) => (
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
                onClick={() => removeItem(item.id)}
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
                aria-label={`${topping.name}を削除`}
                className="text-notice ml-auto px-2"
                onClick={() => removeTopping(item.id, topping.id)}
              >
                <XIcon size={10} strokeWidth={3} aria-hidden />
              </Button>
            </div>
          ))}

          <div className="flex h-11 flex-row items-center justify-between text-lg font-medium">
            <p className="w-18">{formatYen(item.unitPrice)}</p>
            <QuantityController
              onDecrease={() => decreaseItemQuantity(item.id)}
              onIncrease={() => increaseItemQuantity(item.id)}
              quantity={item.quantity}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
