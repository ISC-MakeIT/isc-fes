"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { storeMenusQueryOptions } from "../api/fetch-store-menus";
import { Menu } from "@/entities/menu";

type StoreMenuListProps = {
  storeId: string;
};

export function StoreMenuList({ storeId }: StoreMenuListProps) {
  const { data } = useSuspenseQuery(storeMenusQueryOptions(storeId));
  return (
    <div>
      {data.map((menu) => (
        <MenuCard menu={menu} key={menu.id} />
      ))}
    </div>
  );
}

type MenuCard = {
  menu: Menu;
};

function MenuCard({ menu }: MenuCard) {
  return <>{menu.name}</>;
}
