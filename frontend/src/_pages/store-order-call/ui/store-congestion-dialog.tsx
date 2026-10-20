"use client";

import {
  StoreCongestionLevel,
  storeDetailQueryOptions,
  updateStore,
} from "@/entities/store";
import { storeDetailKey, storeListKeys } from "@/shared/config";
import { ActionButton } from "@/shared/ui/action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";
import { RadioGroup } from "@/shared/ui/radio-group";
import { SharpCorneredTriangleIcon } from "@/shared/ui/sharp-cornered-triangle-icon";
import { toast } from "@/shared/ui/toast";
import { Radio } from "@base-ui/react/radio";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

const CONGESTION_REMINDER_INTERVAL_MS = 20 * 60 * 1000;

const congestionOptions = [
  { value: 3, label: "混雑" },
  { value: 2, label: "普通" },
  { value: 1, label: "空き" },
] satisfies { value: StoreCongestionLevel; label: string }[];

type StoreCongestionDialogProps = {
  storeId: string;
};

export function StoreCongestionDialog({ storeId }: StoreCongestionDialogProps) {
  const { data: store } = useSuspenseQuery(storeDetailQueryOptions(storeId));
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] =
    useState<StoreCongestionLevel | null>(null);
  const congestionLevel = selectedLevel ?? store.congestionLevel;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setIsOpen(true);
    }, CONGESTION_REMINDER_INTERVAL_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: updateStore,
    onSuccess: (store) => {
      queryClient.setQueryData(storeDetailKey(store.id), store);
      queryClient.invalidateQueries({ queryKey: storeListKeys.all() });
    },
    onError: (error) => {
      toast.add({
        type: "error",
        title: "混雑状況を更新できませんでした",
        description: error.message,
      });
    },
    onSettled: () => {
      setIsOpen(false);
      setSelectedLevel(null);
    },
  });

  return (
    <Dialog open={isOpen} disablePointerDismissal>
      <DialogContent
        showCloseButton={false}
        className="shadow-dialog-primary max-h-[calc(100dvh-2rem)] max-w-[min(33.875rem,calc(100%-2rem))] gap-0 overflow-y-auto p-6 text-center sm:max-w-135.5 sm:p-8"
      >
        <DialogTitle className="text-xl leading-7 font-semibold sm:text-2xl">
          現在の混雑状況は？
        </DialogTitle>
        <DialogDescription className="text-foreground mt-2 text-sm sm:text-base">
          この情報はフロアガイドに表示されます。
        </DialogDescription>

        <RadioGroup
          aria-label="現在の混雑状況"
          value={congestionLevel}
          disabled={mutation.isPending}
          onValueChange={setSelectedLevel}
          className="mt-8 grid-cols-3 gap-2 sm:gap-4"
        >
          {congestionOptions.map((option) => (
            <Radio.Root
              key={option.value}
              value={option.value}
              className="border-primary data-checked:bg-primary data-checked:text-primary-foreground focus-visible:ring-ring/50 flex h-12 cursor-pointer items-center justify-center gap-1 rounded-md border text-lg font-semibold outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-3 sm:text-2xl"
            >
              <Radio.Indicator className="flex items-center">
                <SharpCorneredTriangleIcon className="text-primary-foreground size-4 sm:size-6" />
              </Radio.Indicator>
              {option.label}
            </Radio.Root>
          ))}
        </RadioGroup>

        <ActionButton
          type="button"
          disabled={mutation.isPending}
          aria-busy={mutation.isPending}
          className="mx-auto mt-10 rounded-md px-12 py-2 text-xl shadow-none sm:text-2xl"
          onClick={() => {
            mutation.mutate({
              storeId: store.id,
              input: { congestionLevel },
            });
          }}
        >
          確定する
        </ActionButton>
      </DialogContent>
    </Dialog>
  );
}
