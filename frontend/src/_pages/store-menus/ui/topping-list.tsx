"use client";

import { ActionButton } from "@/shared/ui/action-button";
import { PlusIcon } from "lucide-react";
import { EditorType, useMenuEditor } from "../model/menu-editor-context";
import { useStoreId } from "../model/hooks/use-store-id";
import { useSuspenseQuery } from "@tanstack/react-query";
import { storeToppingsQueryOptions } from "../api/fetch-store-toppings";
import { HeadingCard } from "@/shared/ui/heading-card";
import { Fragment } from "react/jsx-runtime";
import { Card } from "@/shared/ui/card";
import { Topping } from "@/entities/topping";

export function ToppingList() {
  const storeId = useStoreId();
  const { setMenuEditor } = useMenuEditor();

  const { data: toppings } = useSuspenseQuery(
    storeToppingsQueryOptions(storeId),
  );

  return (
    <section className="space-y-6">
      <HeadingCard className="px-8 py-4">カスタマイズ</HeadingCard>
      <div className="grid grid-cols-[minmax(0,1fr)_4.375rem] gap-x-6 gap-y-6">
        {toppings.map((topping) => (
          <Fragment key={topping.id}>
            <ToppingCard topping={topping} />
            <div></div>
          </Fragment>
        ))}
      </div>
      <ActionButton
        className="px-6 py-4 text-lg font-bold"
        isDot={false}
        onClick={() => setMenuEditor([EditorType.CreateTopping])}
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
  const { setMenuEditor } = useMenuEditor();
  return (
    <Card
      className="border-foreground shadow-primary flex cursor-pointer flex-row items-center gap-4 rounded-sm border px-6 py-4 font-bold shadow-[4px_4px_0]"
      onClick={() => setMenuEditor([EditorType.EditTopping, topping.id])}
    >
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3">
        <p className="truncate">{topping.name}</p>
        <p>￥{topping.unitPrice}</p>
      </div>
    </Card>
  );
}
