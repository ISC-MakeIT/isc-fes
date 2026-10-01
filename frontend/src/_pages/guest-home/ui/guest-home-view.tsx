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
      <div className="flex flex-col gap-y-8 lg:grid lg:grid-cols-[37.5rem_minmax(0,42.5rem)] lg:justify-center">
        <div>
          {/* TODO: キービジュアルができしだい配備 */}
          <AspectRatioImage
            ratio={HERO_IMAGE_ASPECT}
            src=""
            alt="キービジュアル"
            className="bg-gray-300 lg:w-140 lg:shrink-0"
          />
          <div className="py-4 lg:hidden">
            <EventBanners />
          </div>
        </div>
        <div>
          <FloorGuide />
        </div>
      </div>
      <div className="hidden py-8 lg:flex">
        <EventBanners />
      </div>
    </HydrationBoundary>
  );
}
