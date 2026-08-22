import { StoreHomeView } from "@/_pages/store-home";

export default async function StoreHomePage({
  params,
}: PageProps<"/member/stores/[id]">) {
  const { id } = await params;
  return <StoreHomeView storeId={id} />;
}
