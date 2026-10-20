import { ActionButton } from "@/shared/ui/action-button";
import { Button } from "@/shared/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";

type OrderConfirmDialogProps = {
  isPending: boolean;
  onConfirm: () => void;
};

export function OrderConfirmDialog({
  isPending,
  onConfirm,
}: OrderConfirmDialogProps) {
  return (
    <DialogContent
      showCloseButton={false}
      className="shadow-dialog-secondary gap-6 overflow-y-auto rounded-lg p-8 ring-0 sm:max-w-98"
    >
      <DialogTitle className="border-notice text-notice mx-auto border-b-2 pb-1 text-center text-lg leading-6 font-bold">
        ※ご注文前にご確認ください※
      </DialogTitle>

      <DialogDescription
        render={<div />}
        className="text-foreground space-y-2 text-base leading-5 font-semibold"
      >
        <p className="font-semibold">
          モバイルオーダーで購入する意思のない注文は禁止しております。ご購入・受け取りの意思のある方のみご利用ください。
          <span className="text-notice">
            悪質な注文など、運営に支障をきたす行為が確認された場合は、運営にて必要な対応を行うことがあります。
          </span>
        </p>
        <p>ご理解・ご協力のほど、よろしくお願いいたします。</p>
      </DialogDescription>

      <ActionButton
        type="button"
        isDot={false}
        disabled={isPending}
        aria-busy={isPending}
        className="w-full rounded-md px-4 py-1.5 text-lg font-bold"
        onClick={onConfirm}
      >
        注文確定
      </ActionButton>

      <DialogClose
        disabled={isPending}
        render={
          <Button
            variant="ghost"
            className="bg-foreground/30 shadow-foreground/60 hover:bg-foreground/40 mx-auto px-4 text-lg font-bold shadow-[4px_4px_0]"
          />
        }
      >
        戻る
      </DialogClose>
    </DialogContent>
  );
}
