import { GuestStoreDetailView } from "@/_pages/guest-store-detail";

export default async function GuestStoreDetailPage({
  params,
}: PageProps<"/stores/[storeId]">) {
  const { storeId } = await params;
  return <GuestStoreDetailView storeId={storeId} />;
}
