import { StoreHomeView } from "@/_pages/store-home";

type StoreHomePageProps = {
  params: Promise<{ id: string }>;
};

export default async function StoreHomePage({ params }: StoreHomePageProps) {
  const { id } = await params;
  return <StoreHomeView storeId={id} />;
}
