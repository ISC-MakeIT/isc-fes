import {
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from "@/shared/lib/safe-local-storage";
import { Temporal } from "temporal-polyfill-lite";

const CONGESTION_REMINDER_STARTED_AT_STORAGE_KEY =
  "isc-fes:congestion-reminder-started-at";

export function readCongestionReminderStartedAt(
  storeId: string,
): Temporal.Instant | null {
  const key = `${CONGESTION_REMINDER_STARTED_AT_STORAGE_KEY}:${storeId}`;
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

export function storeCongestionReminderStartedAt(
  storeId: string,
  startedAt: Temporal.Instant,
): boolean {
  return setStorageItem(
    `${CONGESTION_REMINDER_STARTED_AT_STORAGE_KEY}:${storeId}`,
    startedAt.toString(),
  );
}
