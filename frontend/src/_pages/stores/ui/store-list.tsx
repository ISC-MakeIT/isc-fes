import { Card } from "@/shared/ui/card";
import { fetchVisibleStores } from "../api/fetchVisibleStores";
import { PreviewImage } from "@/shared/ui/preview-image";
import { Store, StoreReviewStatus } from "@/entities/store";
import { Skeleton } from "@/shared/ui/skeleton";
import { Mask } from "@/shared/ui/mask";
import { AspectRatio } from "@/shared/ui/aspect-ratio";
import Link from "next/link";
import { storeDetailUrl } from "@/shared/config";

export async function StoreList() {
  const stores = await fetchVisibleStores();

  return stores.map((store) => <StoreCard key={store.id} store={store} />);
}

type StoreCardProps = {
  store: Store;
};

// TODO: 他でも使うようになったらentities/storesに切り出す
export function StoreCard({ store }: StoreCardProps) {
  const isPending = store.reviewStatus === StoreReviewStatus.Pending;
  return (
    <div className="border-primary overflow-hidden rounded-xl border-2">
      <Mask active={isPending} label="申請中">
        <Link href={storeDetailUrl(store.id)}>
          <StoreCardShell
            image={<PreviewImage imagePath={store.imageUrl} />}
            title={store.name}
            description={store.description}
          />
        </Link>
      </Mask>
    </div>
  );
}

export function StoreCardSkelton() {
  return (
    <StoreCardShell
      image={
        <AspectRatio ratio={16 / 9}>
          <Skeleton className="h-full w-full" />
        </AspectRatio>
      }
      title={<Skeleton className="h-4 w-full" />}
      description={<Skeleton className="h-4 w-full" />}
    />
  );
}

type StoreCardShellProps = {
  image: React.ReactNode;
  title: React.ReactNode | string;
  description: React.ReactNode | string;
};

function StoreCardShell({ image, title, description }: StoreCardShellProps) {
  const titleStyle = "line-clamp-2 text-lg";
  const descriptionStyle = "text-muted-foreground line-clamp-3 text-sm";

  return (
    <Card className="flex h-36 flex-row items-center p-6 sm:h-44">
      <div className="w-32 shrink-0 sm:w-56">{image}</div>
      <div className="flex min-w-0 flex-1 flex-col justify-center space-y-1">
        {typeof title === "string" ? (
          <h3 className={titleStyle}>{title}</h3>
        ) : (
          <div className={titleStyle}>{title}</div>
        )}

        {typeof description === "string" ? (
          <p className={descriptionStyle}>{description}</p>
        ) : (
          <div className={descriptionStyle}>{description}</div>
        )}
      </div>
    </Card>
  );
}
