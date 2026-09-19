import { ActionButton } from "@/shared/ui/action-button";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/shared/ui/dialog";
import { ReactNode } from "react";

type DeleteItemButtonProps = {
  deleteFunction: () => void;
  itemName: string;
  dialogContent: ReactNode;
  buttonLabel: string;
  errroMessage?: string;
};

export function DeleteItemButton({
  deleteFunction,
  itemName,
  buttonLabel,
  dialogContent,
  errroMessage,
}: DeleteItemButtonProps) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="destructive"
            className="shadow-button-destructive h-9 px-4 text-xl font-medium"
          >
            削除
          </Button>
        }
      />
      <DialogContent className="shadow-dialog-primary flex flex-col items-center gap-6 px-8 pt-18 pb-8">
        <div className="space-y-4 text-center text-xl font-medium">
          <p>{itemName}</p>
          <p>{dialogContent}</p>
        </div>

        {errroMessage && <p className="text-notice text-sm">{errroMessage}</p>}

        <ActionButton
          variant="destructive"
          onClick={deleteFunction}
          className="rounded-xl px-14 py-4 shadow-none"
        >
          {buttonLabel}
        </ActionButton>
      </DialogContent>
    </Dialog>
  );
}
