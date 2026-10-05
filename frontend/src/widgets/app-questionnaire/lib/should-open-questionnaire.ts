import {
  QUESTIONNAIRE_COOLDOWN,
  QUESTIONNAIRE_PROBABILITIES,
  QuestionnaireTrigger,
} from "../config/questionnaire";
import { Temporal } from "temporal-polyfill-lite";

type ShouldOpenQuestionnaireParams = {
  trigger: QuestionnaireTrigger;
  hasPendingQuestionnaire: boolean;
  lastReviewedAt: Temporal.Instant | null;
  now: Temporal.Instant;
  randomValue: number;
};

export function shouldOpenQuestionnaire({
  trigger,
  hasPendingQuestionnaire,
  lastReviewedAt,
  now,
  randomValue,
}: ShouldOpenQuestionnaireParams): boolean {
  // 一度レビューが表示されたら途中離脱しても次の抽選で必ずレビューを表示させる
  if (hasPendingQuestionnaire) {
    return true;
  }

  if (lastReviewedAt !== null) {
    const nextAvailableAt = lastReviewedAt.add(QUESTIONNAIRE_COOLDOWN);

    if (Temporal.Instant.compare(now, nextAvailableAt) < 0) {
      return false;
    }
  }

  return randomValue < QUESTIONNAIRE_PROBABILITIES[trigger];
}
