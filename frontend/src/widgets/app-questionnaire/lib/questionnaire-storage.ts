import { Temporal } from "temporal-polyfill-lite";
import {
  LAST_REVIEW_SUBMITTED_AT_STORAGE_KEY,
  PENDING_QUESTIONNAIRE_STORAGE_KEY,
  QuestionnaireTrigger,
} from "../config/questionnaire";
import {
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from "./safe-local-storage";
import { v } from "@/shared/lib/valibot";

export function readPendingQuestionnaireTrigger(): QuestionnaireTrigger | null {
  const value = getStorageItem(PENDING_QUESTIONNAIRE_STORAGE_KEY);

  if (value === null) {
    return null;
  }

  const result = v.safeParse(v.enum(QuestionnaireTrigger), value);

  if (!result.success) {
    removeStorageItem(PENDING_QUESTIONNAIRE_STORAGE_KEY);
    return null;
  }

  return result.output;
}

export function storePendingQuestionnaireTrigger(
  trigger: QuestionnaireTrigger,
): boolean {
  return setStorageItem(PENDING_QUESTIONNAIRE_STORAGE_KEY, trigger);
}

export function removePendingQuestionnaireTrigger(): boolean {
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
