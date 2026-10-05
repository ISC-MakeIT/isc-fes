"use client";

import { Dialog, DialogContent, DialogHeader } from "@/shared/ui/dialog";
import { QuestionnaireTrigger } from "../config/questionnaire";
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
  return (
    <Dialog open disablePointerDismissal>
      <DialogContent
        showCloseButton={false}
        className="shadow-dialog-primary p-8"
      >
        <DialogHeader className="flex flex-row gap-2">
          <Image src={AppIcon} alt={"アプリのロゴ"} className="w-12" />
          <div className="flex flex-col font-bold">
            <p className="text-sm">学園祭アプリ</p>
            <h1 className="text-xl">ふぇすNavi　アンケート</h1>
          </div>
        </DialogHeader>

        <QuestionnaireForm trigger={trigger} onSubmitted={onSubmitted} />
      </DialogContent>
    </Dialog>
  );
}
