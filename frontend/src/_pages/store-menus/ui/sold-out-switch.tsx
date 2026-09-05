"use client";

import { Dialog, DialogContent, DialogTrigger } from "@/shared/ui/dialog";
import { Switch } from "@/shared/ui/switch";
import { useMutation } from "@tanstack/react-query";
import { updateMenuSoldOutStatus } from "../api/update-menu-sold-out-status";
import { useState } from "react";
import { Menu } from "@/entities/menu";
import { ActionButton } from "@/shared/ui/action-button";

type SoldOutSwitch = {
  menu: Menu;
};

export function SoldOutSwitch({ menu }: SoldOutSwitch) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // 検証用のステート
  const [isSoldOut, setIsSoldOut] = useState(menu.soldOut);
  const mutation = useMutation({
    mutationFn: updateMenuSoldOutStatus,
    onSuccess: (value) => {
      setIsDialogOpen(false);
      setIsSoldOut(value);
    },
  });

  const confirmationMessage = isSoldOut ? (
    <p>
      の<span className="text-notice">完売状態を解除</span>しますか？
    </p>
  ) : (
    <p>
      を<span className="text-notice">完売状態</span>にしますか？
    </p>
  );

  const buttonLabel = isSoldOut ? "完売解除" : "完売した！";

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
            aria-label={`${menu.name}の販売状態を変更`}
          />
        }
      />

      <DialogContent className="shadow-dialog-primary flex flex-col items-center justify-center gap-5 px-8 pt-18 pb-8 data-closed:hidden">
        <div className="space-y-4 text-center text-xl font-bold">
          <p>{menu.name}</p>
          {confirmationMessage}
        </div>

        {mutation.isError && (
          <p className="text-notice text-sm">{mutation.error.message}</p>
        )}

        <ActionButton
          disabled={mutation.isPending}
          // TODO: variantのdestructiveをfigmaのデザインに寄せる。影響範囲が大きいので別PRで
          variant={isSoldOut ? "destructive" : "default"}
          className="shadow-none"
          onClick={() =>
            mutation.mutate({ soldOutStatus: isSoldOut ? false : true })
          }
        >
          {buttonLabel}
        </ActionButton>
      </DialogContent>
    </Dialog>
  );
}
