"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { storeMenusQueryOptions } from "../api/fetch-store-menus";
import { formatYen } from "../lib/formatYen";
import { Card } from "@/shared/ui/card";
import { Menu } from "@/entities/menu";
import { HeadingCard } from "@/shared/ui/heading-card";
import { cn } from "@/shared/lib/utils";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { MENU_IMAGE_ASPECT } from "@/shared/config";

type StoreMenuListProps = {
  storeId: string;
  className?: string;
};

export function StoreMenuList({ storeId, className }: StoreMenuListProps) {
  const { data: menus } = useSuspenseQuery(storeMenusQueryOptions(storeId));

  return (
    <div className={cn("space-y-8 px-6 py-8", className)}>
      <HeadingCard className="px-8 py-2">メニュー</HeadingCard>

      {menus.length === 0 && (
        <p className="text-center">
          メニューが登録されていません。
          <br />
          商品管理画面からメニューを登録してください。
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,11.375rem)] justify-center gap-8">
        {menus.map((menu) => (
          <MenuCard menu={menu} key={menu.id} />
        ))}
      </div>
    </div>
  );
}

type MenuCardProps = {
  menu: Menu;
};

export function MenuCard({ menu }: MenuCardProps) {
  return (
    <Card className="shadow-primary border-foreground gap-6 rounded-sm border px-4 py-6 shadow-[8px_8px_0_0]">
      <AspectRatioImage
        ratio={MENU_IMAGE_ASPECT}
        className="w-37.5"
        src={menu.imageUrl}
        alt={`${menu.name}の画像`}
      />
      <div className="space-y-2">
        <p className="line-clamp-2 h-[2lh] font-bold">{menu.name}</p>
        <p className="text-lg font-bold">{formatYen(menu.unitPrice)}</p>
      </div>
    </Card>
  );
}
