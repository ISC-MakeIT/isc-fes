import { FESTIVAL_TIME_ZONE, HERO_IMAGE_ASPECT } from "@/shared/config";
import { FloorGuide } from "./floor-guide";
import { createQueryClient } from "@/shared/api";
import { visibleStoresQueryOptions } from "@/entities/store";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { EventBanners } from "./event-banners";
import { Temporal } from "temporal-polyfill-lite";

export async function GuestHomeView() {
  const queryClient = createQueryClient();
  await queryClient.prefetchQuery(visibleStoresQueryOptions());

  // 独自のクラスインスタンスはServer/Clientの境界を越えられないのでStringにしてクライアントに渡す
  const initialDateTime =
    Temporal.Now.plainDateTimeISO(FESTIVAL_TIME_ZONE).toString();

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
          <EventBanners initialDateTime={initialDateTime} />
        </div>
        <div className="lg:col-start-2 lg:row-start-1">
          <FloorGuide />
        </div>
      </div>
    </HydrationBoundary>
  );
}
