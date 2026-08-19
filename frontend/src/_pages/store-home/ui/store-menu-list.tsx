"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { storeMenusQueryOptions } from "../api/fetch-store-menus";
import { formatYen } from "../lib/formatYen";
import Image from "next/image";
import { AspectRatio } from "@/shared/ui/aspect-ratio";
import { Card } from "@/shared/ui/card";
import { Menu } from "@/entities/menu";
import { HeadingCard } from "@/shared/ui/heading-card";

type StoreMenuListProps = {
  storeId: string;
};

export function StoreMenuList({ storeId }: StoreMenuListProps) {
  const { data } = useSuspenseQuery(storeMenusQueryOptions(storeId));
  return (
    <div className="space-y-8 px-6 py-8">
      <HeadingCard className="px-8 py-2">メニュー</HeadingCard>
      <div className="flex flex-row flex-wrap gap-8">
        {data.map((menu) => (
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
      <AspectRatio className="h-30" ratio={5 / 4}>
        <Image
          fill
          className="object-cover"
          src={menu.imageUrl}
          alt="メニューの画像"
        />
      </AspectRatio>
      <div className="space-y-2">
        <p className="line-clamp-2 h-[2lh] font-bold">{menu.name}</p>
        <p className="text-lg font-bold">{formatYen(menu.unitPrice)}</p>
      </div>
    </Card>
  );
}
