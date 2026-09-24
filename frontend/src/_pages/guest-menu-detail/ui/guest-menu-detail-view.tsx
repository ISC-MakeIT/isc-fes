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
      <div className="px-6 py-8 pb-32">
        <div className="justify-center gap-8 space-y-8 md:grid md:grid-cols-[minmax(0,35rem)_27.5rem]">
          <MenuInfo storeId={storeId} menuId={menuId} />
          <div className="md:border-primary/50 py-8 md:border-l-2 md:pt-0">
            <ToppingSelector storeId={storeId} menuId={menuId} />
          </div>
        </div>
      </div>
    </HydrationBoundary>
  );
}
