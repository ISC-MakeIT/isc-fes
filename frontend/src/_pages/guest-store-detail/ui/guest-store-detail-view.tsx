import { fetchStoreDetail } from "@/_pages/store-home/api/fetch-store-detail";
import { STORE_IMAGE_ASPECT } from "@/shared/config";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { Card } from "@/shared/ui/card";
import { HeadingCard } from "@/shared/ui/heading-card";
import { MenuList } from "./menu-list";
import { roomMapImages } from "../model/room-map-images";

type GuestStoreDetailViewProps = {
  storeId: string;
};

export async function GuestStoreDetailView({
  storeId,
}: GuestStoreDetailViewProps) {
  const store = await fetchStoreDetail(storeId);
  const mapImage = roomMapImages[store.room];

  return (
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
              <AllergenCard allergenName={allergen.name} key={allergen.id} />
            ))}
          </div>
        </div>

        <MenuList storeId={storeId} />

        <section className="space-y-8 px-6 pt-8 pb-16">
          <HeadingCard className="px-14 py-2">マップ</HeadingCard>
        </section>
      </section>
    </div>
  );
}

type AllergenCardProps = {
  allergenName: string;
};

function AllergenCard({ allergenName }: AllergenCardProps) {
  return (
    <Card className="border-allergen-card rounded-sm border px-4 py-2 text-sm">
      {allergenName}
    </Card>
  );
}
