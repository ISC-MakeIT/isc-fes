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
  const [isSoldOut, setIsSoldOut] = useState(false);
  const mutation = useMutation({
    mutationFn: updateMenuSoldOutStatus,
    onSuccess: (value) => {
      setIsSoldOut(value);
      setIsDialogOpen(false);
    },
  });
  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        setIsDialogOpen(open);
      }}
    >
      <DialogTrigger
        nativeButton={false}
        render={<Switch checked={isSoldOut} size="lg" />}
      />

      <DialogContent className="shadow-dialog-primary flex flex-col items-center justify-center gap-5 px-8 pt-18 pb-8">
        <div className="space-y-4 text-center text-xl font-bold">
          <p>{menu.name}</p>
          <p>
            を<span className="text-notice">完売状態</span>にしますか？
          </p>
        </div>

        <ActionButton
          disabled={mutation.isPending}
          className="shadow-none"
          onClick={() => mutation.mutate({ soldOutStatus: true })}
        >
          完売した！
        </ActionButton>
      </DialogContent>
    </Dialog>
  );
}
