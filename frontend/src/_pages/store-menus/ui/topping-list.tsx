"use client";

import { ActionButton } from "@/shared/ui/action-button";
import { PlusIcon } from "lucide-react";
import { useStoreId } from "../model/hooks/use-store-id";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { storeToppingsQueryOptions } from "../api/fetch-store-toppings";
import { HeadingCard } from "@/shared/ui/heading-card";
import { Fragment } from "react/jsx-runtime";
import { Topping } from "@/entities/topping";
import { Button } from "@/shared/ui/button";
import { SoldOutSwitch } from "./sold-out-switch";
import { editTopping } from "../api/edit-topping";
import { storeToppingsKey } from "@/shared/config";
import { EditorTarget, useMenuEditor } from "../model/hooks/use-menu-editor";

export function ToppingList() {
  const storeId = useStoreId();
  const { openEditor } = useMenuEditor();

  const queryClient = useQueryClient();

  const { data: toppings } = useSuspenseQuery(
    storeToppingsQueryOptions(storeId),
  );

  return (
    <section className="space-y-6">
      <HeadingCard className="px-8 py-4">カスタマイズ</HeadingCard>
      <div className="grid grid-cols-[minmax(0,1fr)_4.375rem] items-center justify-items-center gap-x-6 gap-y-6">
        {toppings.map((topping) => (
          <Fragment key={topping.id}>
            <ToppingCard topping={topping} />
            <SoldOutSwitch
              itemName={topping.name}
              isSoldOut={topping.soldOut}
              onConfirm={async () => {
                await editTopping({
                  storeId,
                  toppingId: topping.id,
                  editToppingInput: { soldOut: !topping.soldOut },
                });
                await queryClient.invalidateQueries({
                  queryKey: storeToppingsKey(storeId),
                });
              }}
            />
          </Fragment>
        ))}
      </div>
      <ActionButton
        className="px-6 py-4 text-lg font-bold"
        isDot={false}
        onClick={() => openEditor(EditorTarget.Topping)}
      >
        <PlusIcon className="size-6" />
        カスタマイズの追加
      </ActionButton>
    </section>
  );
}

type ToppingCardProps = {
  topping: Topping;
};

export function ToppingCard({ topping }: ToppingCardProps) {
  const { openEditor } = useMenuEditor();
  return (
    <Button
      type="button"
      variant="outline"
      className="border-foreground shadow-primary flex h-auto w-full cursor-pointer flex-row items-center gap-4 rounded-sm border px-6 py-4 font-bold shadow-[4px_4px_0]"
      onClick={() => openEditor(EditorTarget.Topping, topping.id)}
    >
      <span className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3">
        <span className="truncate text-left">{topping.name}</span>
        <span>￥{topping.unitPrice}</span>
      </span>
    </Button>
  );
}
