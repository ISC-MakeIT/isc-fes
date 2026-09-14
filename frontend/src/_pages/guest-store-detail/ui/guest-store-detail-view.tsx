import { fetchStoreDetail } from "@/_pages/store-home/api/fetch-store-detail";
import { STORE_IMAGE_ASPECT } from "@/shared/config";
import { Card } from "@/shared/ui/card";
import { PreviewImage } from "@/shared/ui/preview-image";

type GuestStoreDetailViewProps = {
  storeId: string;
};

export async function GuestStoreDetailView({
  storeId,
}: GuestStoreDetailViewProps) {
  const store = await fetchStoreDetail(storeId);

  return (
    <div>
      <PreviewImage
        ratio={STORE_IMAGE_ASPECT}
        imagePath={store.imageUrl}
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
