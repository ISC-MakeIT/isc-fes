"use client";

import { ActionButton } from "@/shared/ui/action-button";
import { HeadingCard } from "@/shared/ui/heading-card";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { CreateMenuForm } from "./create-menu-form";

enum FormType {
  CreateMenu = "createMenu",
  EditMenu = "editMenu",
  CreateTopping = "createTopping",
  EditTopping = "editTopping",
}

type StoreMenusViewProps = {
  storeId: string;
};

export function StoreMenusView({ storeId }: StoreMenusViewProps) {
  const [activeForm, setActiveForm] = useState<FormType | null>(null);

  return (
    <div className="grid grid-cols-[1fr_25rem]">
      <div className="pt-18">
        <HeadingCard>メニュー</HeadingCard>

        <ActionButton
          className="gap-0 text-lg font-bold"
          isDot={false}
          onClick={() => setActiveForm(FormType.CreateMenu)}
        >
          <PlusIcon className="size-6" />
          メニューの追加
        </ActionButton>
      </div>
      <div className="border-primary min-h-screen border-l pt-18">
        {activeForm === FormType.CreateMenu && (
          <CreateMenuForm storeId={storeId} />
        )}
      </div>
    </div>
  );
}
