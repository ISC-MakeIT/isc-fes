import { HERO_IMAGE_ASPECT } from "@/shared/config";
import { FloorGuide } from "./floor-guide";
import { createQueryClient } from "@/shared/api";
import { visibleStoresQueryOptions } from "@/entities/store";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";

export async function GuestHomeView() {
  const queryClient = createQueryClient();
  await queryClient.prefetchQuery(visibleStoresQueryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-y-8 lg:flex-row">
        {/* TODO: キービジュアルができしだい配備 */}
        <AspectRatioImage
          ratio={HERO_IMAGE_ASPECT}
          src=""
          alt="キービジュアル"
          className="bg-gray-300 lg:w-140 lg:shrink-0"
        />
        <FloorGuide />
      </div>
    </HydrationBoundary>
  );
}
