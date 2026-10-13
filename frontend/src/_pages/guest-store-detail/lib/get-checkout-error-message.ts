import { CheckoutCode } from "../api/fetch-checkoutable";

const checkoutErrorMessage = {
  store_closed: "店舗は閉店しています。",
  store_order_disabled: "店舗は注文受付を停止しています。",
  cart_version_conflict: "カートが更新されています。再読み込みしてください。",
  cart_empty: "カートに商品がありません。",
  cart_items_unavailable: "購入できない商品またはトッピングが含まれています。",
  invalid_cart: "カートの内容が不正です。内容を確認してください。",
  order_limit_reached: "同時に注文できる件数の上限に達しています。",
} satisfies Record<CheckoutCode, string>;

export function getCheckoutErrorMessage(code: CheckoutCode) {
  return checkoutErrorMessage[code];
}
