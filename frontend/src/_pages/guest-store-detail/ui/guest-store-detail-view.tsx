import { storeDetailQueryOptions } from "@/entities/store";
import { STORE_IMAGE_ASPECT } from "@/shared/config";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { HeadingCard } from "@/shared/ui/heading-card";
import { MenuList } from "./menu-list";
import { roomMapImages } from "../model/room-map-images";
import Image from "next/image";
import { createQueryClient } from "@/shared/api";
import { storeMenusQueryOptions } from "@/entities/menu";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AllergenBadge } from "@/entities/allergen";

type GuestStoreDetailViewProps = {
  storeId: string;
};

export async function GuestStoreDetailView({
  storeId,
}: GuestStoreDetailViewProps) {
  const queryClient = createQueryClient();
  const [store] = await Promise.all([
    queryClient.fetchQuery(storeDetailQueryOptions(storeId)),
    queryClient.prefetchQuery(storeMenusQueryOptions(storeId)),
  ]);

  const mapImage = roomMapImages[store.room];

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="mx-auto flex flex-col md:max-w-200">
        <div className="md:flex md:flex-row md:items-start md:gap-1.5 md:px-6 md:pt-10 md:pb-8">
          <AspectRatioImage
            ratio={STORE_IMAGE_ASPECT}
            src={store.imageUrl}
            className="md:w-77 md:shrink-0"
            alt="店舗のバナー画像"
          />

          <section className="min-w-0 flex-1 space-y-8 px-8 py-8 text-left">
            <h1 className="text-[1.375rem] font-bold">{store.name}</h1>
            <p className="text-[1.375rem] font-bold">{store.room}</p>
            <p className="text-lg">{store.description}</p>
            <div className="space-y-4">
              <p className="font-semibold">アレルギー対象8品目</p>
              {store.allergens.length === 0 ? (
                <p>該当なし</p>
              ) : (
                <div className="flex flex-row flex-wrap justify-start gap-2">
                  {store.allergens.map((allergen) => (
                    <AllergenBadge
                      key={allergen.id}
                      allergen={allergen}
                      className="w-19"
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <MenuList storeId={storeId} />

        <section className="flex flex-col items-center gap-8 px-6 pt-8 pb-16">
          <HeadingCard className="px-14 py-2">マップ</HeadingCard>
          {mapImage && (
            <Image
              alt={`${store.room}のマップ`}
              src={mapImage}
              className="w-75"
            />
          )}
        </section>
      </div>
    </HydrationBoundary>
  );
}
