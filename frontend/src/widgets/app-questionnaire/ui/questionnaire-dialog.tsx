"use client";

import { Dialog, DialogContent, DialogHeader } from "@/shared/ui/dialog";
import {
  AudienceTarget,
  QUESTIONNAIRE_AUDIENCE_BY_TRIGGER,
  QuestionnaireTrigger,
} from "../config/questionnaire";
import { QuestionnaireForm } from "./questionnaire-form";
import AppIcon from "./assets/app-icon.png";
import Image from "next/image";

type QuestionnaireDialogProps = {
  trigger: QuestionnaireTrigger;
  onSubmitted: () => void;
};

export function QuestionnaireDialog({
  trigger,
  onSubmitted,
}: QuestionnaireDialogProps) {
  const audience = QUESTIONNAIRE_AUDIENCE_BY_TRIGGER[trigger];

  return (
    <Dialog open disablePointerDismissal>
      <DialogContent
        showCloseButton={false}
        className="shadow-dialog-primary p-8"
      >
        {audience === AudienceTarget.Guest ? (
          <DialogHeader className="flex flex-row gap-2">
            <Image src={AppIcon} alt={"アプリのロゴ"} className="w-12" />
            <div className="flex flex-col font-bold">
              <p className="text-sm">学園祭アプリ</p>
              <h1 className="text-xl">ふぇすNavi アンケート</h1>
            </div>
          </DialogHeader>
        ) : (
          <DialogHeader className="flex flex-col items-center text-lg font-bold">
            <p>店舗スタッフ対象</p>
            <p>『 ふぇすNavi 』アンケート</p>
          </DialogHeader>
        )}

        <QuestionnaireForm trigger={trigger} onSubmitted={onSubmitted} />
      </DialogContent>
    </Dialog>
  );
}
