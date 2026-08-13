import { Card, CardHeader } from "@/shared/ui/card";
import { fetchVisibleStores } from "../api/fetchVisibleStores";
import { PreviewImage } from "@/shared/ui/preview-image";
import { Skeleton } from "@/shared/ui/skeleton";
import { Store } from "@/entities/store";

export async function StoreList() {
  const stores = await fetchVisibleStores();

  return stores.map((store) => <StoreCard key={store.id} store={store} />);
}

export function SkeltonStoreList() {
  return <Skeleton className="h-8 w-1/2 bg-black" />;
}

type StoreCardProps = {
  store: Store;
};

function StoreCard({ store }: StoreCardProps) {
  return (
    <Card className="grid-row-2 grid grid-cols-[1fr_1fr] gap-x-3 py-5">
      <CardHeader className="row-span-2">
        <PreviewImage imagePath={store.imageUrl} />
      </CardHeader>
      <h3 className="self-start pt-2">{store.name}</h3>
      <p className="text-muted-foreground self-start pb-2 text-sm">
        {store.description}
      </p>
    </Card>
  );
}
