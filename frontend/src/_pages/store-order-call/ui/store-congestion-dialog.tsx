"use client";

import {
  StoreCongestionLevel,
  storeDetailQueryOptions,
  updateStore,
} from "@/entities/store";
import {
  FESTIVAL_TIME_ZONE,
  storeDetailKey,
  storeListKeys,
} from "@/shared/config";
import { isWithinFestivalPeriod } from "@/shared/lib/festival-period";
import { ActionButton } from "@/shared/ui/action-button";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
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
import Image from "next/image";
import { Temporal } from "temporal-polyfill-lite";
import {
  readCongestionReminderNextShowAt,
  storeCongestionReminderNextShowAt,
} from "../lib/store-congestion-storage";
import congestionUpdateIcon from "./assets/congestion-update-icon.png";

const CONGESTION_REMINDER_INTERVAL = { hours: 1 } as const;
const CONGESTION_CHECK_INTERVAL_MS = 30_000;

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

    function checkReminder() {
      if (
        !isWithinFestivalPeriod(
          Temporal.Now.plainDateTimeISO(FESTIVAL_TIME_ZONE),
        )
      ) {
        return;
      }

      const now = Temporal.Now.instant();
      const nextShowAt = readCongestionReminderNextShowAt(storeId);

      if (nextShowAt === null) {
        storeCongestionReminderNextShowAt(
          storeId,
          now.add(CONGESTION_REMINDER_INTERVAL),
        );
        return;
      }

      if (Temporal.Instant.compare(now, nextShowAt) >= 0) {
        setIsOpen(true);
      }
    }

    checkReminder();
    const intervalId = setInterval(checkReminder, CONGESTION_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [isOpen, storeId]);

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
      storeCongestionReminderNextShowAt(
        storeId,
        Temporal.Now.instant().add(CONGESTION_REMINDER_INTERVAL),
      );
      setIsOpen(false);
      setSelectedLevel(null);
    },
  });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) {
          setIsOpen(true);
        }
      }}
      disablePointerDismissal
    >
      <DialogTrigger
        aria-label="混雑状況を更新"
        render={
          <Button
            variant="outline"
            className="border-primary fixed right-0 bottom-6 z-30 h-14 gap-0 rounded-l-md rounded-r-none p-2"
          />
        }
      >
        <span
          aria-hidden="true"
          className="relative h-8.75 w-4.75 overflow-hidden"
        >
          <Image
            src={congestionUpdateIcon}
            alt=""
            className="absolute top-0 -left-2.5 size-8.75 max-w-none"
            draggable={false}
          />
        </span>
        <span className="bg-primary text-primary-foreground px-2 py-1 text-center text-xs font-semibold">
          混雑状況
          <br />
          更新
        </span>
      </DialogTrigger>
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
