import {
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from "@/shared/lib/safe-local-storage";
import { Temporal } from "temporal-polyfill-lite";

const CONGESTION_REMINDER_NEXT_SHOW_AT_STORAGE_KEY =
  "isc-fes:congestion-reminder-next-show-at";

export function readCongestionReminderNextShowAt(
  storeId: string,
): Temporal.Instant | null {
  const key = `${CONGESTION_REMINDER_NEXT_SHOW_AT_STORAGE_KEY}:${storeId}`;
  const value = getStorageItem(key);

  if (value === null) {
    return null;
  }

  try {
    return Temporal.Instant.from(value);
  } catch {
    removeStorageItem(key);
    return null;
  }
}

export function storeCongestionReminderNextShowAt(
  storeId: string,
  nextShowAt: Temporal.Instant,
): boolean {
  return setStorageItem(
    `${CONGESTION_REMINDER_NEXT_SHOW_AT_STORAGE_KEY}:${storeId}`,
    nextShowAt.toString(),
  );
}
