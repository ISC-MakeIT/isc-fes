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
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Store, storeDetailQueryOptions, updateStore } from "@/entities/store";
import { cn } from "@/shared/lib/utils";
import { ActionButton } from "@/shared/ui/action-button";
import { storeDetailKey } from "@/shared/config";
import { toast } from "@/shared/ui/toast";
import { useState } from "react";

type CloseStoreButtonProps = {
  storeId: string;
};

export function CloseStoreButton({ storeId }: CloseStoreButtonProps) {
  const { data: store } = useSuspenseQuery(storeDetailQueryOptions(storeId));

  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogTrigger
        render={<SidebarMenuButton className={cn(sidebarNavigationStyle)} />}
      >
        {store.closedAt ? (
          <DotText className="text-primary">店舗を開ける</DotText>
        ) : (
          <DotText className="text-notice">店舗を閉める</DotText>
        )}
      </DialogTrigger>

      <CloseStoreDialog store={store} onSuccess={() => setIsOpen(false)} />
    </Dialog>
  );
}

type CloseStoreDialogProps = {
  store: Store;
  onSuccess: () => void;
};

function CloseStoreDialog({ store, onSuccess }: CloseStoreDialogProps) {
  const queryClient = useQueryClient();

  const isClosed = !!store.closedAt;

  const mutation = useMutation({
    mutationFn: updateStore,
    onSuccess: (store) => {
      queryClient.setQueryData(storeDetailKey(store.id), store);
      onSuccess();
    },

    onError: (error) => {
      toast.add({
        type: "error",
        title: "店舗の情報を変更できませんでした",
        description: error.message,
      });
    },
  });

  return (
    <DialogContent className="flex flex-col items-center justify-center px-16 pt-18 pb-8 data-closed:hidden">
      <DialogTitle className="text-center text-xl font-semibold">
        {isClosed ? "店舗を開けますか？" : "本当に店舗を閉めますか？"}
      </DialogTitle>

      <div className="mt-6">
        {isClosed ? (
          <ActionButton
            className="px-13 shadow-none"
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => {
              mutation.mutate({
                storeId: store.id,
                input: {
                  ...store,
                  closed: false,
                },
              });
            }}
          >
            店舗を開ける
          </ActionButton>
        ) : (
          <ActionButton
            className="px-13 shadow-none"
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => {
              mutation.mutate({
                storeId: store.id,
                input: {
                  ...store,
                  closed: true,
                },
              });
            }}
          >
            店舗を閉める
          </ActionButton>
        )}
      </div>
    </DialogContent>
  );
}
