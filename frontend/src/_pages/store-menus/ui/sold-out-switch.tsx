"use client";

import { Dialog, DialogContent, DialogTrigger } from "@/shared/ui/dialog";
import { Switch } from "@/shared/ui/switch";
import { useState } from "react";
import { ActionButton } from "@/shared/ui/action-button";

type SoldOutSwitch = {
  submitFunction: () => void;
  itemName: string;
  isDisabledButton: boolean;
  isSoldOut: boolean;
  errorMessage?: string;
};

export function SoldOutSwitch({
  submitFunction,
  isDisabledButton,
  isSoldOut,
  itemName,
  errorMessage,
}: SoldOutSwitch) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  function handleSubmit() {
    setIsDialogOpen(false);
    submitFunction();
  }

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        setIsDialogOpen(open);
      }}
    >
      <DialogTrigger
        nativeButton={false}
        render={
          <Switch
            checked={isSoldOut}
            size="lg"
            aria-label={`${itemName}の販売状態を変更`}
          />
        }
      />

      <DialogContent className="shadow-dialog-primary flex flex-col items-center justify-center gap-5 px-8 pt-18 pb-8 data-closed:hidden">
        <div className="space-y-4 text-center text-xl font-bold">
          <p>{itemName}</p>
          {isSoldOut ? (
            <p>
              の<span className="text-notice">完売状態を解除</span>しますか？
            </p>
          ) : (
            <p>
              を<span className="text-notice">完売状態</span>にしますか？
            </p>
          )}
        </div>

        {errorMessage && (
          <p className="text-notice text-sm" role="alert">
            {errorMessage}
          </p>
        )}

        <ActionButton
          disabled={isDisabledButton}
          // TODO: variantのdestructiveをfigmaのデザインに寄せる。影響範囲が大きいので別PRで
          variant={isSoldOut ? "destructive" : "default"}
          className="shadow-none"
          onClick={handleSubmit}
        >
          {isSoldOut ? "完売解除" : "完売した！"}
        </ActionButton>
      </DialogContent>
    </Dialog>
  );
}
