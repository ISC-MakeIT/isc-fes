"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  AudienceTarget,
  QUESTIONNAIRE_AUDIENCE_BY_TRIGGER,
  QuestionnaireTrigger,
} from "../config/questionnaire";
import { QuestionnaireForm } from "./questionnaire-form";
import AppIcon from "./assets/app-icon.png";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { trackEvent } from "@/shared/lib/analytics";

type QuestionnaireDialogProps = {
  trigger: QuestionnaireTrigger;
  onSubmitted: () => void;
};

export function QuestionnaireDialog({
  trigger,
  onSubmitted,
}: QuestionnaireDialogProps) {
  const audience = QUESTIONNAIRE_AUDIENCE_BY_TRIGGER[trigger];
  const lastTrackedTrigger = useRef<QuestionnaireTrigger | null>(null);

  useEffect(() => {
    if (lastTrackedTrigger.current === trigger) {
      return;
    }

    lastTrackedTrigger.current = trigger;
    trackEvent("open_review", { trigger });
  }, [trigger]);

  return (
    <Dialog open disablePointerDismissal>
      <DialogContent
        showCloseButton={false}
        className="shadow-dialog-primary max-h-[calc(100dvh-2rem)] overflow-y-auto p-8"
      >
        {audience === AudienceTarget.Guest ? (
          <DialogHeader className="items-center text-center">
            <div className="flex items-center gap-2">
              <Image
                src={AppIcon}
                alt={"アプリのロゴ"}
                className="w-12"
                draggable={false}
              />
              <p className="text-sm">学園祭アプリ</p>
            </div>
            <DialogTitle className="text-xl">ふぇすNavi アンケート</DialogTitle>
          </DialogHeader>
        ) : (
          <DialogHeader className="flex flex-col items-center text-lg font-bold">
            <p>店舗スタッフ対象</p>
            <DialogTitle className="text-lg font-bold">
              『 ふぇすNavi 』アンケート
            </DialogTitle>
          </DialogHeader>
        )}

        <QuestionnaireForm trigger={trigger} onSubmitted={onSubmitted} />
      </DialogContent>
    </Dialog>
  );
}
