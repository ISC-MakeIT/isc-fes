import { HeadingCard } from "@/shared/ui/heading-card";
import { RegisterStoreForm } from "./register-store-form";
import { createQueryClient } from "@/shared/api";
import { activeRoomsQueryOptions } from "@/entities/room";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { allergenQueryOptions } from "@/entities/allergen";

export async function RegisterStoreView() {
  const queryClient = createQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(activeRoomsQueryOptions()),
    queryClient.prefetchQuery(allergenQueryOptions()),
  ]);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="mx-auto space-y-10 px-6 text-center">
        <div className="space-y-6">
          <HeadingCard className="px-8 py-4">店舗登録</HeadingCard>
          <p className="text-sm">
            この情報は、モバイルオーダーの画面にも使用されます
          </p>
        </div>
        <RegisterStoreForm />
      </div>
    </HydrationBoundary>
  );
}
