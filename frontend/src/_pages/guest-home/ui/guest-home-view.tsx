import { HERO_IMAGE_ASPECT } from "@/shared/config";
import { AspectRatio } from "@/shared/ui/aspect-ratio";
import { FloorGuide } from "./floor-guide";
import { createQueryClient } from "@/shared/api";
import { visibleStoresQueryOptions } from "@/entities/store";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export async function GuestHomeView() {
  const queryClient = createQueryClient();
  await queryClient.prefetchQuery(visibleStoresQueryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-8 md:flex md:flex-row">
        {/* TODO: キービジュアルができしだい配備 */}
        <AspectRatio
          ratio={HERO_IMAGE_ASPECT}
          className="bg-gray-300 md:w-140"
        />
        <div className="mx-auto">
          <FloorGuide />
        </div>
      </div>
    </HydrationBoundary>
  );
}
