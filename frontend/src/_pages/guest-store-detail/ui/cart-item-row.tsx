import {
  CartItem,
  CartItemTopping,
  MAX_CART_ITEM_QUANTITY,
} from "@/entities/cart";
import { SoldOutLabel } from "@/entities/menu";
import { MENU_IMAGE_ASPECT } from "@/shared/config";
import { formatYen } from "@/shared/lib/formatYen";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { Button } from "@/shared/ui/button";
import { QuantityController } from "@/widgets/quantity-controller";
import { CornerLeftUpIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useCartOperation } from "../model/cart-operation-context";

type CartItemRowProps = {
  cartItem: CartItem;
};
export function CartItemRow({ cartItem }: CartItemRowProps) {
  const { increaseItemQuantity, decreaseItemQuantity, isSaving } =
    useCartOperation();

  return (
    <li
      key={cartItem.id}
      className="border-foreground relative flex flex-col gap-2 border-b px-6 py-4"
    >
      {!cartItem.available && <CartItemSoldOutOverlay cartItem={cartItem} />}

      <div className="border-foreground flex flex-row gap-6 border-b border-dashed py-2">
        <AspectRatioImage
          alt={`${cartItem.name}の画像`}
          src={cartItem.imageUrl}
          ratio={MENU_IMAGE_ASPECT}
          className="w-25 shrink-0 rounded-sm"
        />
        <p className="line-clamp-3 text-xl font-semibold">{cartItem.name}</p>
      </div>

      {cartItem.toppings.map((topping) => (
        <CartItemToppingRow topping={topping} key={topping.id} />
      ))}

      <div className="flex h-11 flex-row items-center justify-between text-lg font-medium">
        <p className="w-18">{formatYen(cartItem.unitPrice)}</p>
        <QuantityController
          onDecrease={() => decreaseItemQuantity(cartItem.id)}
          onIncrease={() => increaseItemQuantity(cartItem.id)}
          quantity={cartItem.quantity}
          isDisabledDecreaseButton={isSaving || cartItem.quantity <= 0}
          isDisabledIncreaseButton={
            isSaving || cartItem.quantity >= MAX_CART_ITEM_QUANTITY
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
  const { removeItem, isSaving } = useCartOperation();
  return (
    <div className="bg-soldout-overlay absolute inset-0 z-10 flex flex-col items-center justify-center">
      <div className="flex flex-col gap-2">
        <Image src={SoldOutLabel} alt="" className="w-60" />
        <p className="text-xs">こちらの商品は只今売り切れとなりました。</p>
      </div>
      <Button
        variant="ghost"
        className="text-notice text-xs font-bold underline underline-offset-2"
        disabled={isSaving}
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
  const { removeTopping, isSaving } = useCartOperation();
  return (
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
        disabled={isSaving}
        onClick={() => removeTopping(topping.cartItemId, topping.toppingId)}
      >
        <XIcon size={10} strokeWidth={3} aria-hidden />
      </Button>
    </div>
  );
}
