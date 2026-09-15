import { StoreKitchenView } from "@/_pages/store-kitchen";

export default async function KitchenPage({
  params,
}: PageProps<"/member/stores/[storeId]/kitchen">) {
  const { storeId } = await params;
  return <StoreKitchenView storeId={storeId} />;
}
