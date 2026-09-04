import { StoreHomeView } from "@/_pages/store-home";

export default async function StoreHomePage({
  params,
}: PageProps<"/member/stores/[storeId]">) {
  const { storeId } = await params;
  return <StoreHomeView storeId={storeId} />;
}
