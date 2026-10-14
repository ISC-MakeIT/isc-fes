"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { SidebarMenuButton } from "@/shared/ui/sidebar";
import { sidebarNavigationStyle } from "./sidebar-navigation-styles";
import { DotText } from "@/shared/ui/dot-text";
import { useSuspenseQuery } from "@tanstack/react-query";
import { storeDetailQueryOptions } from "@/entities/store";
import { cn } from "@/shared/lib/utils";
import { ActionButton } from "@/shared/ui/action-button";

type CloseStoreButtonProps = {
  storeId: string;
};

export function CloseStoreButton({ storeId }: CloseStoreButtonProps) {
  const { data: store } = useSuspenseQuery(storeDetailQueryOptions(storeId));

  return (
    <Dialog>
      <DialogTrigger
        render={<SidebarMenuButton className={cn(sidebarNavigationStyle)} />}
      >
        {store.closedAt ? (
          <DotText className="text-primary">店舗を開ける</DotText>
        ) : (
          <DotText className="text-notice">店舗を閉める</DotText>
        )}
      </DialogTrigger>

      <CloseStoreDialog isClosed={!!store.closedAt} />
    </Dialog>
  );
}

type CloseStoreDialogProps = {
  isClosed: boolean;
};

function CloseStoreDialog({ isClosed }: CloseStoreDialogProps) {
  return (
    <DialogContent className="flex flex-col items-center justify-center px-16 pt-18 pb-8">
      <DialogTitle className="text-center text-xl font-semibold">
        {isClosed ? "店舗を開けますか？" : "本当に店舗を閉めますか？"}
      </DialogTitle>

      <div className="mt-6">
        {isClosed ? (
          <ActionButton className="px-13 shadow-none" variant="secondary">
            店舗を開ける
          </ActionButton>
        ) : (
          <ActionButton className="px-13 shadow-none" variant="destructive">
            店舗を閉める
          </ActionButton>
        )}
      </div>
    </DialogContent>
  );
}
