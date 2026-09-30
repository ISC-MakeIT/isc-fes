import { allergenQueryOptions } from "@/entities/allergen";
import { activeRoomsQueryOptions } from "@/entities/room";
import { storeDetailQueryOptions } from "@/entities/store";
import { createQueryClient } from "@/shared/api";
import { HeadingCard } from "@/shared/ui/heading-card";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { StoreEditForm } from "./store-edit-form";

type StoreEditViewProps = { storeId: string };

export async function StoreEditView({ storeId }: StoreEditViewProps) {
  const queryClient = createQueryClient();
  const [store] = await Promise.all([
    queryClient.fetchQuery({
      ...storeDetailQueryOptions(storeId),
      staleTime: 0,
    }),
    queryClient.prefetchQuery(activeRoomsQueryOptions()),
    queryClient.prefetchQuery(allergenQueryOptions()),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="mx-auto flex w-full max-w-180 flex-col items-center gap-20 px-6 py-18 md:gap-10 md:px-5">
        <div className="flex flex-col items-center gap-6 text-center">
          <HeadingCard className="px-8 py-4 text-xl max-md:leading-6">
            店舗情報
          </HeadingCard>
          <p className="text-[15px] max-md:leading-[18px]">
            この情報は、モバイルオーダーの画面にも使用されます。
          </p>
        </div>
        <StoreEditForm key={storeId} storeId={storeId} initialStore={store} />
      </div>
    </HydrationBoundary>
  );
}
