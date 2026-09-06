import { HeadingCard } from "@/shared/ui/heading-card";
import { RegisterStoreForm } from "./register-store-form";
import { CenterLayout } from "@/shared/ui/center-layout";
import { createQueryClient } from "@/shared/api";
import { activeRoomsQueryOptions } from "@/entities/room";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export async function RegisterStoreView() {
  const queryClient = createQueryClient();
  await queryClient.prefetchQuery(activeRoomsQueryOptions());
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CenterLayout className="text-center">
        <HeadingCard>店舗登録</HeadingCard>
        <p className="text-sm">
          この情報は、モバイルオーダーの画面にも使用されます
        </p>
        <RegisterStoreForm />
      </CenterLayout>
    </HydrationBoundary>
  );
}
