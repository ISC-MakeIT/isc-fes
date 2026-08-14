import { Card, CardHeader } from "@/shared/ui/card";
import { fetchVisibleStores } from "../api/fetchVisibleStores";
import { PreviewImage } from "@/shared/ui/preview-image";
import { Store } from "@/entities/store";
import { Skeleton } from "@/shared/ui/skeleton";

export async function StoreList() {
  const stores = await fetchVisibleStores();

  return stores.map((store) => <StoreCard key={store.id} store={store} />);
}

type StoreCardProps = {
  store: Store;
};

// TODO: 他でも使うようになったらentities/storesに切り出す
export function StoreCard({ store }: StoreCardProps) {
  return (
    <StoreCardShell
      image={<PreviewImage imagePath={store.imageUrl} />}
      title={store.name}
      description={store.description}
    />
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
  const titleStyle = "line-clamp-2 self-start text-lg";
  const descriptionStyle =
    "text-muted-foreground line-clamp-3 self-start text-sm";

  return (
    <Card className="grid grid-cols-[1fr_1fr] grid-rows-2 gap-x-3 gap-y-1 px-2 py-5">
      <CardHeader className="row-span-2 my-auto">{image}</CardHeader>
      {typeof title === "string" ? (
        <h3 className={titleStyle}>{title}</h3>
      ) : (
        <div className={descriptionStyle}>{title}</div>
      )}

      {typeof description === "string" ? (
        <p className={descriptionStyle}>{description}</p>
      ) : (
        <div className={descriptionStyle}>{description}</div>
      )}
    </Card>
  );
}
