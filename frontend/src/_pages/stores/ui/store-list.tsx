import { Card, CardHeader } from "@/shared/ui/card";
import { fetchVisibleStores } from "../api/fetchVisibleStores";
import { PreviewImage } from "@/shared/ui/preview-image";
import { Store, StoreReviewStatus } from "@/entities/store";
import { Skeleton } from "@/shared/ui/skeleton";
import { Mask } from "@/shared/ui/mask";

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
        <StoreCardShell
          image={<PreviewImage imagePath={store.imageUrl} />}
          title={store.name}
          description={store.description}
        />
      </Mask>
    </div>
  );
}

export function StoreCardSkelton() {
  return (
    <StoreCardShell
      image={<Skeleton className="h-32 w-full" />}
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
    <Card className="flex h-32 flex-row items-center px-2 py-3">
      <CardHeader className="w-1/2">{image}</CardHeader>
      <div className="flex w-1/2 flex-col justify-center space-y-1">
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
