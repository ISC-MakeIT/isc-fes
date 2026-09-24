"use client";

import { storeMenusQueryOptions } from "@/entities/menu";
import { MENU_IMAGE_ASPECT } from "@/shared/config";
import { formatYen } from "@/shared/lib/formatYen";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { useSuspenseQuery } from "@tanstack/react-query";

type MenuInfoProps = {
  storeId: string;
  menuId: string;
};

export function MenuInfo({ storeId, menuId }: MenuInfoProps) {
  const { data: menu } = useSuspenseQuery({
    ...storeMenusQueryOptions(storeId),
    select: (menus) => menus.find((menu) => menu.id === menuId),
  });

  if (!menu) {
    return (
      <p className="flex flex-1 justify-center text-xl">
        メニューが見つかりませんでした
      </p>
    );
  }

  return (
    <section className="space-y-8">
      <AspectRatioImage
        ratio={MENU_IMAGE_ASPECT}
        alt={`${menu.name}の画像`}
        className="mx-auto w-full rounded-sm md:max-w-75"
      />
      <div className="space-y-8 md:space-y-6">
        <h1 className="text-[1.375rem] font-bold md:text-center">
          {menu.name}
        </h1>
        <h2 className="text-[1.375rem] font-bold">
          {formatYen(menu.unitPrice)}
        </h2>
        <p className="text-lg">{menu.description}</p>
      </div>
    </section>
  );
}
