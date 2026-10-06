import { Sentry } from "@/shared/config";

export function getStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    reportStorageError("getItem", key, error);
    return null;
  }
}

export function setStorageItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    reportStorageError("setItem", key, error);
    return false;
  }
}

export function removeStorageItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    reportStorageError("removeItem", key, error);
    return false;
  }
}

type StorageOperation = "getItem" | "setItem" | "removeItem";

function reportStorageError(
  operation: StorageOperation,
  key: string,
  error: unknown,
) {
  Sentry.withScope((scope) => {
    scope.setLevel("warning");
    scope.setTag("feature", "app-questionnaire");
    scope.setContext("localStorage", {
      operation,
      key,
    });
    Sentry.captureException(error);
  });
}
