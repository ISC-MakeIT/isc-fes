import { Card } from "@/shared/ui/card";
import { fetchVisibleStores } from "@/entities/store";
import { Store, StoreReviewStatus } from "@/entities/store";
import { Mask } from "@/shared/ui/mask";
import Link from "next/link";
import { STORE_IMAGE_ASPECT, storeHomeUrl } from "@/shared/config";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";

export async function StoreList() {
  const stores = await fetchVisibleStores();

  return (
    <ul className="w-full space-y-6">
      {stores.map((store) => (
        <li key={store.id}>
          <StoreCard store={store} />
        </li>
      ))}
    </ul>
  );
}

type StoreCardProps = {
  store: Store;
};

function StoreCard({ store }: StoreCardProps) {
  return (
    <Card className="border-primary w-full overflow-hidden rounded-sm border-2 p-0">
      <Mask
        active={store.reviewStatus === StoreReviewStatus.Pending}
        label="申請中"
      >
        <Link href={storeHomeUrl(store.id)}>
          <div className="flex flex-row gap-4 p-4">
            <AspectRatioImage
              ratio={STORE_IMAGE_ASPECT}
              src={store.imageUrl}
              alt={`${store.name}の店舗画像`}
              className="w-40 shrink-0"
            />
            <div className="flex min-w-0 flex-1 flex-col justify-center space-y-2">
              <h3 className="line-clamp-3 text-xl md:line-clamp-1">
                {store.name}
              </h3>
              <div className="text-muted-foreground line-clamp-2 hidden text-sm md:flex">
                {store.description}
              </div>
            </div>
          </div>
        </Link>
      </Mask>
    </Card>
  );
}
