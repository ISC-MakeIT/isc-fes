import { storeMenusQueryOptions } from "@/entities/menu";
import { menuToppingsQueryOptions } from "@/entities/topping";
import { createQueryClient } from "@/shared/api";
import { MenuInfo } from "./menu-info";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ToppingSelector } from "./topping-selector";
import { notFound } from "next/navigation";
import { MenuOrderActions } from "./menu-order-actions";
import { fetchCartQueryOptions } from "@/entities/cart";
import { MenuOrderForm } from "./menu-order-form";

type GuestMenuDetailViewProps = {
  storeId: string;
  menuId: string;
};

export async function GuestMenuDetailView({
  storeId,
  menuId,
}: GuestMenuDetailViewProps) {
  const queryClient = createQueryClient();

  const [menus] = await Promise.all([
    queryClient.fetchQuery(storeMenusQueryOptions(storeId)),
    queryClient.prefetchQuery(fetchCartQueryOptions(storeId)),
    queryClient.prefetchQuery(menuToppingsQueryOptions({ storeId, menuId })),
  ]);

  const menu = menus.find((menu) => menu.id === menuId);

  if (!menu) {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="px-6 py-8 pb-32">
        <div className="justify-center gap-8 space-y-8 md:grid md:grid-cols-[minmax(0,35rem)_27.5rem]">
          <MenuInfo menu={menu} />
          <MenuOrderForm storeId={storeId} menu={menu} />
        </div>
      </div>
    </HydrationBoundary>
  );
}
