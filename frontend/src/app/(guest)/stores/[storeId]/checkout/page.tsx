import { CheckoutView } from "@/_pages/checkout";

export default async function CheckoutPage({
  params,
}: PageProps<"/stores/[storeId]/checkout">) {
  const { storeId } = await params;
  return <CheckoutView storeId={storeId} />;
}
