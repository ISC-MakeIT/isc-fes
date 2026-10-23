"use client";

import { createContext, use, useCallback, useState } from "react";
import { QuestionnaireTrigger } from "../config/questionnaire";
import { Temporal } from "temporal-polyfill-lite";
import { shouldOpenQuestionnaire } from "../lib/should-open-questionnaire";
import {
  readLastReviewedAt,
  readPendingQuestionnaireTrigger,
  removePendingQuestionnaireTrigger,
  storeLastReviewSubmittedAt,
  storePendingQuestionnaireTrigger,
} from "../lib/questionnaire-storage";
import { QuestionnaireDialog } from "../ui/questionnaire-dialog";

type QuestionnaireContextValue = {
  isQuestionnaireOpen: boolean;
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

  const requestQuestionnaire = useCallback((trigger: QuestionnaireTrigger) => {
    const pendingTrigger = readPendingQuestionnaireTrigger();

    if (pendingTrigger !== null) {
      setActiveTrigger(pendingTrigger);
      return;
    }

    const shouldOpen = shouldOpenQuestionnaire({
      trigger,
      lastReviewedAt: readLastReviewedAt(),
      now: Temporal.Now.instant(),
      randomValue: Math.random(),
    });

    if (!shouldOpen) {
      return;
    }

    // localStorageが使えない環境ならアンケートを開かない
    if (!storePendingQuestionnaireTrigger(trigger)) {
      return;
    }

    setActiveTrigger(trigger);
  }, []);

  function handleSubmitted() {
    storeLastReviewSubmittedAt(Temporal.Now.instant());
    removePendingQuestionnaireTrigger();
    setActiveTrigger(null);
  }

  return (
    <QuestionnaireContext
      value={{
        isQuestionnaireOpen: activeTrigger !== null,
        requestQuestionnaire,
      }}
    >
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
