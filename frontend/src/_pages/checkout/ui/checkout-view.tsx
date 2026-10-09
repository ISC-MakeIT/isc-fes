import { fetchCartQueryOptions } from "@/entities/cart";
import { createQueryClient } from "@/shared/api";
import { HeadingCard } from "@/shared/ui/heading-card";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CartList } from "./cart-list";
import { ActionButton } from "@/shared/ui/action-button";

type CheckoutViewProps = {
  storeId: string;
};

export async function CheckoutView({ storeId }: CheckoutViewProps) {
  const queryClient = createQueryClient();
  await queryClient.prefetchQuery(fetchCartQueryOptions(storeId));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="mx-auto flex max-w-150 flex-col justify-center">
        <div className="p-8">
          <HeadingCard className="px-14 py-2">注文確認</HeadingCard>
        </div>

        <CartList storeId={storeId} />

        <ActionButton
          className="mx-auto mt-8 mb-18 px-14 py-2 text-[1.375rem] font-bold"
          isDot={false}
        >
          注文する
        </ActionButton>
      </main>
    </HydrationBoundary>
  );
}
