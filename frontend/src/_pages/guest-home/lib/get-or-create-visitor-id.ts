import {
  getStorageItem,
  setStorageItem,
} from "@/shared/lib/safe-local-storage";

const VISITOR_ID_STORAGE_KEY = "isc-fes:sentry-visitor-id:v1";

export function getOrCreateVisitorId(): string {
  const storedVisitorId = getStorageItem(VISITOR_ID_STORAGE_KEY);
  if (storedVisitorId) {
    return storedVisitorId;
  }

  const visitorId = crypto.randomUUID();
  setStorageItem(VISITOR_ID_STORAGE_KEY, visitorId);
  return visitorId;
}
