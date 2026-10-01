import { HERO_IMAGE_ASPECT } from "@/shared/config";
import { FloorGuide } from "./floor-guide";
import { createQueryClient } from "@/shared/api";
import { visibleStoresQueryOptions } from "@/entities/store";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { EventBanners } from "./event-banners";

export async function GuestHomeView() {
  const queryClient = createQueryClient();
  await queryClient.prefetchQuery(visibleStoresQueryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="grid grid-cols-1 lg:grid-cols-[37.5rem_minmax(0,42.5rem)] lg:justify-center">
        {/* TODO: キービジュアルができしだい配備 */}
        <AspectRatioImage
          ratio={HERO_IMAGE_ASPECT}
          src=""
          alt="キービジュアル"
          className="bg-gray-300 lg:col-start-1 lg:w-140 lg:shrink-0"
        />
        <div className="lg:col-span-2 lg:col-start-1">
          <EventBanners />
        </div>
        <div className="lg:col-start-2 lg:row-start-1">
          <FloorGuide />
        </div>
      </div>
    </HydrationBoundary>
  );
}
