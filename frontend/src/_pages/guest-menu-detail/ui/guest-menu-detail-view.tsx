import { storeMenusQueryOptions } from "@/entities/menu";
import { menuToppingsQueryOptions } from "@/entities/topping";
import { createQueryClient } from "@/shared/api";
import { MenuInfo } from "./menu-info";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ToppingSelector } from "./topping-selector";

type GuestMenuDetailViewProps = {
  storeId: string;
  menuId: string;
};

export async function GuestMenuDetailView({
  storeId,
  menuId,
}: GuestMenuDetailViewProps) {
  const queryClient = createQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(storeMenusQueryOptions(storeId)),
    queryClient.prefetchQuery(menuToppingsQueryOptions({ storeId, menuId })),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-8 px-6 py-8">
        <MenuInfo storeId={storeId} menuId={menuId} />
        <ToppingSelector storeId={storeId} menuId={menuId} />
      </div>
    </HydrationBoundary>
  );
}
