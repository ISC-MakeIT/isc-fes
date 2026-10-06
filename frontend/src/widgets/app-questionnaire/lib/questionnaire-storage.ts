import { Temporal } from "temporal-polyfill-lite";
import {
  LAST_REVIEW_SUBMITTED_AT_STORAGE_KEY,
  PENDING_QUESTIONNAIRE_STORAGE_KEY,
} from "../config/questionnaire";
import {
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from "./safe-local-storage";

export function readPendingQuestionnaire(): boolean {
  return getStorageItem(PENDING_QUESTIONNAIRE_STORAGE_KEY) !== null;
}

export function storePendingQuestionnaire(): boolean {
  // 読み取り時にはキーが存在するかどうかで判定しているので値はなんでもいい
  return setStorageItem(PENDING_QUESTIONNAIRE_STORAGE_KEY, "true");
}

export function removePendingQuestionnaire(): boolean {
  return removeStorageItem(PENDING_QUESTIONNAIRE_STORAGE_KEY);
}

export function readLastReviewedAt(): Temporal.Instant | null {
  const value = getStorageItem(LAST_REVIEW_SUBMITTED_AT_STORAGE_KEY);

  if (value === null) {
    return null;
  }

  try {
    return Temporal.Instant.from(value);
  } catch {
    removeStorageItem(LAST_REVIEW_SUBMITTED_AT_STORAGE_KEY);
    return null;
  }
}

export function storeLastReviewSubmittedAt(
  submittedAt: Temporal.Instant,
): boolean {
  return setStorageItem(
    LAST_REVIEW_SUBMITTED_AT_STORAGE_KEY,
    submittedAt.toString(),
  );
}
