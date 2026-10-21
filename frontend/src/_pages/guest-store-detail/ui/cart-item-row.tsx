import {
  CartItem,
  CartItemTopping,
  MAX_CART_ITEM_QUANTITY,
} from "@/entities/cart";
import { MENU_IMAGE_ASPECT } from "@/shared/config";
import { formatYen } from "@/shared/lib/formatYen";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { Button } from "@/shared/ui/button";
import { QuantityController } from "@/widgets/quantity-controller";
import { CornerLeftUpIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useCartOperation } from "../model/cart-operation-context";
import ToppingSoldOut from "./assets/topping-sold-out.svg";
import { SoldOutLabel } from "@/shared/ui";
import { calculateCartTotal } from "../lib/calculate-cart-total";

type CartItemRowProps = {
  cartItem: CartItem;
};
export function CartItemRow({ cartItem }: CartItemRowProps) {
  const { increaseItemQuantity, decreaseItemQuantity, isBusy } =
    useCartOperation();

  const itemTotal = calculateCartTotal([cartItem]);

  return (
    <li
      key={cartItem.id}
      className="border-foreground relative flex flex-col gap-2 border-b px-6 py-4"
    >
      {!cartItem.available && <CartItemSoldOutOverlay cartItem={cartItem} />}

      <div className="border-foreground flex flex-row items-center gap-6 border-b border-dashed py-2">
        <AspectRatioImage
          alt={`${cartItem.name}の画像`}
          src={cartItem.imageUrl}
          ratio={MENU_IMAGE_ASPECT}
          className="w-25 shrink-0 rounded-sm"
          sizes="100px"
        />
        <div className="flex flex-col gap-2">
          <p className="line-clamp-3 text-lg font-semibold">{cartItem.name}</p>
          <p className="text-xl font-semibold">
            {formatYen(cartItem.unitPrice)}
          </p>
        </div>
      </div>

      {cartItem.toppings.map((topping) => (
        <CartItemToppingRow topping={topping} key={topping.id} />
      ))}

      <div className="flex h-11 flex-row items-center justify-between text-lg font-medium">
        <p className="w-18">{formatYen(itemTotal)}</p>
        <QuantityController
          onDecrease={() => decreaseItemQuantity(cartItem.id)}
          onIncrease={() => increaseItemQuantity(cartItem.id)}
          quantity={cartItem.quantity}
          isDisabledDecreaseButton={isBusy || cartItem.quantity <= 0}
          isDisabledIncreaseButton={
            isBusy || cartItem.quantity >= MAX_CART_ITEM_QUANTITY
          }
        />
      </div>
    </li>
  );
}

type CartItemSoldOutOverlayProps = {
  cartItem: CartItem;
};
function CartItemSoldOutOverlay({ cartItem }: CartItemSoldOutOverlayProps) {
  const { removeItem, isBusy } = useCartOperation();
  return (
    <div className="bg-soldout-overlay absolute inset-0 z-10 flex flex-col items-center justify-center">
      <div className="flex flex-col gap-2">
        <Image src={SoldOutLabel} alt="" className="w-60" draggable={false} />
        <p className="text-xs">こちらの商品は只今売り切れとなりました。</p>
      </div>
      <Button
        variant="ghost"
        className="text-notice text-xs font-bold underline underline-offset-2"
        disabled={isBusy}
        onClick={() => removeItem(cartItem.id)}
      >
        削除する
      </Button>
    </div>
  );
}

type CartItemToppingRowProps = {
  topping: CartItemTopping;
};

function CartItemToppingRow({ topping }: CartItemToppingRowProps) {
  const { removeTopping, isBusy } = useCartOperation();
  return (
    <div
      key={topping.id}
      className="border-foreground flex flex-row items-center gap-2 border-b border-dashed py-2"
    >
      <div className="relative flex min-w-0 flex-1 items-center justify-start self-stretch pl-20">
        <div className="flex flex-row items-start justify-start">
          <CornerLeftUpIcon size={15} className="shrink-0 justify-start" />
          <div className="flex flex-col gap-2 font-semibold">
            <p>{topping.name}</p>
            <p>{formatYen(topping.unitPrice)}</p>
          </div>
        </div>

        {!topping.available && (
          <div className="bg-soldout-overlay pointer-events-none absolute inset-0 flex items-center justify-center px-4">
            <Image src={ToppingSoldOut} alt="" draggable={false} />
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        aria-label={`${topping.name}を削除`}
        className="text-notice flex"
        disabled={isBusy}
        onClick={() => removeTopping(topping.cartItemId, topping.toppingId)}
      >
        <XIcon size={10} strokeWidth={3} aria-hidden />
      </Button>
    </div>
  );
}
