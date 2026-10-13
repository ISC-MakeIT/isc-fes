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
      <div className="flex flex-col items-center justify-center">
        <Image
          src={HeroImageMobile}
          alt="キービジュアル"
          className="block bg-gray-300 lg:hidden"
        />
        <Image
          src={HeroImageDesktop}
          alt="キービジュアル"
          className="hidden bg-gray-300 lg:block"
        />

        <EventBanners initialDateTime={initialDateTime} />

        <FloorGuide />
      </div>
    </HydrationBoundary>
  );
}
