"use client";

import { formatYen } from "@/shared/lib/formatYen";
import { Menu, storeMenusQueryOptions } from "@/entities/menu";
import { guestMenuDetailUrl, MENU_IMAGE_ASPECT } from "@/shared/config";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { Card } from "@/shared/ui/card";
import { HeadingCard } from "@/shared/ui/heading-card";
import { useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";
import { trackEvent } from "@/shared/lib/analytics";
import { useEffect, useRef } from "react";
import Image from "next/image";
import { SoldOutLabel } from "@/entities/menu";
import { cn } from "@/shared/lib/utils";

type MenuListProps = {
  storeId: string;
};

export function MenuList({ storeId }: MenuListProps) {
  const { data: menus } = useSuspenseQuery(storeMenusQueryOptions(storeId));
  const lastTrackedList = useRef<string | null>(null);

  useEffect(() => {
    if (menus.length === 0) return;
    const listKey = `${storeId}:${menus.map((menu) => menu.id).join(",")}`;
    if (lastTrackedList.current === listKey) return;
    lastTrackedList.current = listKey;
    trackEvent("view_item_list", {
      item_list_id: `store:${storeId}`,
      store_id: storeId,
      items: menus.map((menu, index) => ({
        item_id: menu.id,
        price: menu.unitPrice,
        affiliation: storeId,
        index,
      })),
    });
  }, [storeId, menus]);

  if (menus.length === 0) {
    return;
  }

  return (
    <section className="space-y-8 px-6 py-8">
      <HeadingCard className="px-14 py-2">メニュー</HeadingCard>

      {/* NOTE: カードを2列表示には画面幅428px必要で、ほとんどのスマホだと1列になってしまうかもなので、メニューカードを可変にして最小2列を維持 */}
      <div className="grid grid-cols-[repeat(2,minmax(0,11.375rem))] justify-center gap-4 md:grid-cols-[repeat(auto-fit,11.375rem)]">
        {menus.map((menu) => (
          <MenuCard key={menu.id} storeId={storeId} menu={menu} />
        ))}
      </div>
    </section>
  );
}

type MenuCardProps = {
  storeId: string;
  menu: Menu;
};

function MenuCard({ menu, storeId }: MenuCardProps) {
  return (
    <div className="relative">
      <Link
        href={guestMenuDetailUrl(storeId, menu.id)}
        key={menu.id}
        className={cn(menu.soldOut && "pointer-events-none")}
        onClick={() =>
          trackEvent("select_item", {
            item_list_id: `store:${storeId}`,
            store_id: storeId,
            items: [
              {
                item_id: menu.id,
                price: menu.unitPrice,
                affiliation: storeId,
              },
            ],
          })
        }
      >
        <Card className="shadow-primary border-foreground space-y-2 rounded-sm border px-4 py-6 shadow-[4px_4px_0]">
          <AspectRatioImage
            ratio={MENU_IMAGE_ASPECT}
            alt={`${menu.name}の画像`}
            src={menu.imageUrl}
            className="max-w-38.5"
          />
          <div className="text-left">
            <p className="line-clamp-2 h-[2lh] font-bold">{menu.name}</p>
            <p>{formatYen(menu.unitPrice)}</p>
          </div>
        </Card>
      </Link>

      {menu.soldOut && (
        <div className="bg-soldout-overlay pointer-events-none absolute inset-0 px-4 py-18">
          <Image src={SoldOutLabel} alt="売り切れ" draggable={false} />
        </div>
      )}
    </div>
  );
}
