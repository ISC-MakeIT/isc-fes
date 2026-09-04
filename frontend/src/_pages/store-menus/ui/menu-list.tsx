"use client";

import { ActionButton } from "@/shared/ui/action-button";
import { HeadingCard } from "@/shared/ui/heading-card";
import { PlusIcon } from "lucide-react";
import { EditorType, useMenuEditor } from "../model/menu-editor-context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { storeMenusQueryOptions } from "@/entities/menu";
import { Menu } from "@/entities/menu";
import { Card } from "@/shared/ui/card";
import { PreviewImage } from "@/shared/ui/preview-image";
import { MENU_IMAGE_ASPECT } from "@/shared/config";
import { useStoreId } from "../model/hooks/use-store-id";

export function MenuList() {
  const storeId = useStoreId();
  const { setMenuEditor } = useMenuEditor();
  const { data: menus } = useSuspenseQuery(storeMenusQueryOptions(storeId));

  return (
    <section className="border-primary border-b px-4">
      <HeadingCard className="px-8 py-4">メニュー</HeadingCard>
      <div className="space-y-6 py-8">
        <div className="grid grid-cols-[1fr_4.375rem] gap-6">
          <div className="space-y-6">
            <p className="border-foreground border-b text-center text-lg">
              メニュー名
            </p>
            {menus.map((menu) => (
              <MenuCard key={menu.id} menu={menu} />
            ))}
          </div>
          <div>
            <p className="border-foreground border-b text-center text-lg">
              完売中
            </p>
          </div>
        </div>

        <ActionButton
          className="px-6 py-4 text-lg font-bold"
          isDot={false}
          onClick={() => setMenuEditor([EditorType.CreateMenu])}
        >
          <PlusIcon className="size-6" />
          メニューの追加
        </ActionButton>
      </div>
    </section>
  );
}

type MenuCard = {
  menu: Menu;
};

function MenuCard({ menu }: MenuCard) {
  const { setMenuEditor } = useMenuEditor();
  return (
    <Card
      className="border-foreground shadow-primary flex cursor-pointer flex-row items-center gap-4 rounded-sm border px-6 py-4 font-bold shadow-[8px_8px_0_0]"
      onClick={() => setMenuEditor([EditorType.EditMenu, menu.id])}
    >
      <PreviewImage
        ratio={MENU_IMAGE_ASPECT}
        alt={menu.name}
        imagePath={menu.imageUrl}
        className="w-12.5"
      />
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3">
        <p className="truncate">{menu.name}</p>
        <p>￥{menu.unitPrice}</p>
      </div>
    </Card>
  );
}
