import {
  QUESTIONNAIRE_COOLDOWN,
  QUESTIONNAIRE_PROBABILITIES,
  QuestionnaireTrigger,
} from "../config/questionnaire";
import { Temporal } from "temporal-polyfill-lite";

type ShouldOpenQuestionnaireParams = {
  trigger: QuestionnaireTrigger;
  lastReviewedAt: Temporal.Instant | null;
  now: Temporal.Instant;
  randomValue: number;
};

export function shouldOpenQuestionnaire({
  trigger,
  lastReviewedAt,
  now,
  randomValue,
}: ShouldOpenQuestionnaireParams): boolean {
  if (lastReviewedAt !== null) {
    const nextAvailableAt = lastReviewedAt.add(QUESTIONNAIRE_COOLDOWN);

    if (Temporal.Instant.compare(now, nextAvailableAt) < 0) {
      return false;
    }
  }

  return randomValue < QUESTIONNAIRE_PROBABILITIES[trigger];
}
