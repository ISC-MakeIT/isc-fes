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
import { Badge } from "@/shared/ui/badge";

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
      <div>
        <AspectRatioImage
          ratio={STORE_IMAGE_ASPECT}
          src={store.imageUrl}
          className="md:w-77"
          alt="店舗のバナー画像"
        />

        <section className="space-y-8 px-8 py-8 text-center">
          <h1 className="text-[1.375rem] font-bold">{store.name}</h1>
          <p className="text-[1.375rem] font-bold">{store.room}</p>
          <p className="text-lg">{store.description}</p>
          <div className="space-y-4">
            <p>アレルギー対象8品目</p>
            <div className="flex flex-row flex-wrap justify-center gap-2">
              {store.allergens.map((allergen) => (
                <AllergenBadge allergenName={allergen.name} key={allergen.id} />
              ))}
            </div>
          </div>
        </section>

        <MenuList storeId={storeId} />

        <section className="flex flex-col items-center gap-8 px-6 pt-8 pb-16">
          <HeadingCard className="px-14 py-2">マップ</HeadingCard>
          {mapImage && (
            <Image
              alt={`${store.room}教室のマップ`}
              src={mapImage}
              className="w-75"
            />
          )}
        </section>
      </div>
    </HydrationBoundary>
  );
}

type AllergenBadgeProps = {
  allergenName: string;
};

function AllergenBadge({ allergenName }: AllergenBadgeProps) {
  return (
    <Badge
      variant="outline"
      className="border-allergen-card h-auto rounded-sm px-4 py-2 text-sm"
    >
      {allergenName}
    </Badge>
  );
}
