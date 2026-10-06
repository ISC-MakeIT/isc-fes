"use client";

import { createContext, use, useState } from "react";
import { QuestionnaireTrigger } from "../config/questionnaire";
import { Temporal } from "temporal-polyfill-lite";
import { shouldOpenQuestionnaire } from "../lib/should-open-questionnaire";
import {
  readLastReviewedAt,
  readPendingQuestionnaire,
  removePendingQuestionnaire,
  storeLastReviewSubmittedAt,
  storePendingQuestionnaire,
} from "../lib/questionnaire-storage";
import { QuestionnaireDialog } from "../ui/questionnaire-dialog";

type QuestionnaireContextValue = {
  requestQuestionnaire: (trigger: QuestionnaireTrigger) => void;
};

const QuestionnaireContext = createContext<QuestionnaireContextValue | null>(
  null,
);

type AppQuestionnaireProviderProps = {
  children: React.ReactNode;
};

export function AppQuestionnaireProvider({
  children,
}: AppQuestionnaireProviderProps) {
  const [activeTrigger, setActiveTrigger] =
    useState<QuestionnaireTrigger | null>(null);

  function requestQuestionnaire(trigger: QuestionnaireTrigger) {
    const isPendingQuestionnaire = readPendingQuestionnaire();

    if (isPendingQuestionnaire) {
      setActiveTrigger(trigger);
      return;
    }

    const now = Temporal.Now.instant();
    const lastReviewedAt = readLastReviewedAt();

    const shouldOpen = shouldOpenQuestionnaire({
      trigger,
      lastReviewedAt,
      hasPendingQuestionnaire: isPendingQuestionnaire,
      now,
      randomValue: Math.random(),
    });

    if (!shouldOpen) {
      return;
    }

    const wasPendingQuestionnaireStored = storePendingQuestionnaire();

    // localStorageが使えない環境ならアンケートを開かない
    if (!wasPendingQuestionnaireStored) {
      return;
    }

    setActiveTrigger(trigger);
  }

  function handleSubmitted() {
    storeLastReviewSubmittedAt(Temporal.Now.instant());
    removePendingQuestionnaire();
    setActiveTrigger(null);
  }

  return (
    <QuestionnaireContext value={{ requestQuestionnaire }}>
      {children}

      {activeTrigger !== null && (
        <QuestionnaireDialog
          trigger={activeTrigger}
          onSubmitted={handleSubmitted}
        />
      )}
    </QuestionnaireContext>
  );
}

export function useAppQuestionnaire(): QuestionnaireContextValue {
  const context = use(QuestionnaireContext);

  if (context === null) {
    throw new Error(
      "useAppQuestionnaireはAppQuestionnaireProvider内で使用してください",
    );
  }

  return context;
}
