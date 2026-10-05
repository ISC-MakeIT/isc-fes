import { Temporal } from "temporal-polyfill-lite";
import {
  LAST_REVIEW_SUBMITTED_AT_STORAGE_KEY,
  PENDING_QUESTIONNAIRE_STORAGE_KEY,
} from "../config/questionnaire";

export function readPendingQuestionnaire(): boolean {
  return localStorage.getItem(PENDING_QUESTIONNAIRE_STORAGE_KEY) !== null;
}

export function storePendingQuestionnaire() {
  // 読み取り時にはキーが存在するかどうかで判定しているので値はなんでもいい
  localStorage.setItem(PENDING_QUESTIONNAIRE_STORAGE_KEY, "true");
}

export function removePendingQuestionnaire() {
  localStorage.removeItem(PENDING_QUESTIONNAIRE_STORAGE_KEY);
}

export function readLastReviewedAt(): Temporal.Instant | null {
  const value = localStorage.getItem(LAST_REVIEW_SUBMITTED_AT_STORAGE_KEY);

  if (value === null) {
    return null;
  }

  try {
    return Temporal.Instant.from(value);
  } catch {
    localStorage.removeItem(LAST_REVIEW_SUBMITTED_AT_STORAGE_KEY);
    return null;
  }
}

export function storeLastReviewSubmittedAt(submittedAt: Temporal.Instant) {
  localStorage.setItem(
    LAST_REVIEW_SUBMITTED_AT_STORAGE_KEY,
    submittedAt.toString(),
  );
}
