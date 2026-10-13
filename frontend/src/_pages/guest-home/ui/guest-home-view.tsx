import { FESTIVAL_TIME_ZONE } from "@/shared/config";
import { FloorGuide } from "./floor-guide";
import { createQueryClient } from "@/shared/api";
import { visibleStoresQueryOptions } from "@/entities/store";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { EventBanners } from "./event-banners";
import { Temporal } from "temporal-polyfill-lite";
import HeroImageMobile from "./assets/hero-image-mobile.jpg";
import HeroImageDesktop from "./assets/hero-image-desktop.jpg";
import Image from "next/image";

export async function GuestHomeView() {
  const queryClient = createQueryClient();
  await queryClient.prefetchQuery(visibleStoresQueryOptions());

  // 独自のクラスインスタンスはServer/Clientの境界を越えられないのでStringにしてクライアントに渡す
  const initialDateTime =
    Temporal.Now.plainDateTimeISO(FESTIVAL_TIME_ZONE).toString();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="grid grid-cols-1 lg:grid-cols-[37.5rem_minmax(0,42.5rem)] lg:justify-center">
        <Image
          src={HeroImageMobile}
          alt="キービジュアル"
          className="block bg-gray-300 lg:col-start-1 lg:hidden lg:w-140 lg:shrink-0"
        />
        <Image
          src={HeroImageDesktop}
          alt="キービジュアル"
          className="lcol-start-1 hidden w-140 shrink-0 bg-gray-300 lg:block"
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
