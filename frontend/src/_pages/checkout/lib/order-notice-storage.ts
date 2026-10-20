import {
  getStorageItem,
  setStorageItem,
} from "@/shared/lib/safe-local-storage";

const ORDER_NOTICE_CONFIRMED_STORAGE_KEY = "isc-fes:order-notice-confirmed:v1";

export function hasConfirmedOrderNotice(): boolean {
  return getStorageItem(ORDER_NOTICE_CONFIRMED_STORAGE_KEY) === "true";
}

export function storeOrderNoticeConfirmation(): boolean {
  return setStorageItem(ORDER_NOTICE_CONFIRMED_STORAGE_KEY, "true");
}
