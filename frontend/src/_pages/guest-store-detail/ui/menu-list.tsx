"use client";

import { formatYen } from "@/shared/lib/formatYen";
import { Menu, storeMenusQueryOptions } from "@/entities/menu";
import { MENU_IMAGE_ASPECT } from "@/shared/config";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { Card } from "@/shared/ui/card";
import { HeadingCard } from "@/shared/ui/heading-card";
import { useSuspenseQuery } from "@tanstack/react-query";

type MenuListProps = {
  storeId: string;
};

export function MenuList({ storeId }: MenuListProps) {
  const { data: menus } = useSuspenseQuery(storeMenusQueryOptions(storeId));

  return (
    <section className="space-y-8 px-6 py-8">
      <HeadingCard className="px-14 py-2">メニュー</HeadingCard>

      <div className="grid grid-cols-[repeat(auto-fit,11.375rem)] justify-center gap-4">
        {menus.map((menu) => (
          <MenuCard menu={menu} key={menu.id} />
        ))}
      </div>
    </section>
  );
}

type MenuCardProps = {
  menu: Menu;
};

function MenuCard({ menu }: MenuCardProps) {
  return (
    <Card className="shadow-primary border-foreground space-y-2 rounded-sm border px-4 py-6 shadow-[4px_4px_0]">
      <AspectRatioImage
        ratio={MENU_IMAGE_ASPECT}
        alt=""
        src={menu.imageUrl}
        className="w-38.5"
      />
      <div className="text-left">
        <p className="line-clamp-2 h-[2lh] font-bold">{menu.name}</p>
        <p>{formatYen(menu.unitPrice)}</p>
      </div>
    </Card>
  );
}
