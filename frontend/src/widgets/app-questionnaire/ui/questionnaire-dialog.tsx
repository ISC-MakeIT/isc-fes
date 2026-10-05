"use client";

import { Dialog, DialogContent, DialogHeader } from "@/shared/ui/dialog";
import { QuestionnaireTrigger } from "../config/questionnaire";
import { QuestionnaireForm } from "./questionnaire-form";

type QuestionnaireDialogProps = {
  trigger: QuestionnaireTrigger;
  onSubmitted: () => void;
};

export function QuestionnaireDialog({
  trigger,
  onSubmitted,
}: QuestionnaireDialogProps) {
  return (
    <Dialog open disablePointerDismissal>
      <DialogContent showCloseButton={false} className="md:max-w-lg">
        <DialogHeader>「ふぇすNavi」アンケート</DialogHeader>

        <QuestionnaireForm trigger={trigger} onSubmitted={onSubmitted} />
      </DialogContent>
    </Dialog>
  );
}
