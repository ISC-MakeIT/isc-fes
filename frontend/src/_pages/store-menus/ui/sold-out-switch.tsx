"use client";

import { Dialog, DialogContent, DialogTrigger } from "@/shared/ui/dialog";
import { Switch } from "@/shared/ui/switch";
import { useState } from "react";
import { ActionButton } from "@/shared/ui/action-button";
import { useMutation } from "@tanstack/react-query";

type SoldOutSwitch = {
  onConfirm: () => Promise<unknown>;
  itemName: string;
  isSoldOut: boolean;
};

export function SoldOutSwitch({
  onConfirm,
  isSoldOut,
  itemName,
}: SoldOutSwitch) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: onConfirm,
    onSuccess: () => setIsDialogOpen(false),
  });

  function handleOpenChange(open: boolean) {
    // 前回の失敗表示を消す
    if (open) mutation.reset();
    setIsDialogOpen(open);
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
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

        {mutation.isError && (
          <p className="text-notice text-sm" role="alert">
            {mutation.error.message}
          </p>
        )}

        <ActionButton
          disabled={mutation.isPending}
          variant={isSoldOut ? "destructive" : "default"}
          className="shadow-none"
          onClick={() => mutation.mutate()}
        >
          {isSoldOut ? "完売解除" : "完売した！"}
        </ActionButton>
      </DialogContent>
    </Dialog>
  );
}
