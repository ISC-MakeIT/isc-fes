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
  title: React.ReactNode;
  description: React.ReactNode;
};

function StoreCardShell({ image, title, description }: StoreCardShellProps) {
  return (
    <Card className="grid-row-2 grid grid-cols-[1fr_1fr] gap-x-3 px-2 py-5">
      <CardHeader className="row-span-2">{image}</CardHeader>
      {/* divじゃなくて見出し、pタグを使いたいけど、pの中にSkeltonを流し込むとハイドレーションエラーになる https://nextjs.org/docs/messages/react-hydration-error */}
      <div className="line-clamp-2 self-start text-lg">{title}</div>
      <div className="text-muted-foreground line-clamp-3 self-start text-sm">
        {description}
      </div>
    </Card>
  );
}
