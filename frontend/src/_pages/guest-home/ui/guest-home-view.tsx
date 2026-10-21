import { FESTIVAL_TIME_ZONE } from "@/shared/config";
import { FloorGuide } from "./floor-guide";
import { createQueryClient } from "@/shared/api";
import { visibleStoresQueryOptions } from "@/entities/store";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { EventBanners } from "./event-banners";
import { Temporal } from "temporal-polyfill-lite";
import { ActiveOrderList } from "./active-order-list";
import { GuestSessionInitializer } from "./guest-session-initializer";
import HeroImageMobile from "./assets/hero-image-mobile.jpg";
import HeroImageDesktop from "./assets/hero-image-desktop.png";
import Image from "next/image";

export async function GuestHomeView() {
  const queryClient = createQueryClient();
  await queryClient.prefetchQuery(visibleStoresQueryOptions());

  // 独自のクラスインスタンスはServer/Clientの境界を越えられないのでStringにしてクライアントに渡す
  const initialDateTime =
    Temporal.Now.plainDateTimeISO(FESTIVAL_TIME_ZONE).toString();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <GuestSessionInitializer />
      <div className="flex flex-col items-center justify-center">
        <div className="relative w-full">
          <ActiveOrderList />
          <Image
            src={HeroImageMobile}
            alt="キービジュアル"
            className="block w-full bg-gray-300 lg:hidden"
            sizes="100vw"
          />
          <Image
            src={HeroImageDesktop}
            alt="キービジュアル"
            className="hidden h-150 bg-gray-300 object-cover lg:block"
            sizes="100vw"
          />
        </div>

        <EventBanners initialDateTime={initialDateTime} />

        <FloorGuide />
      </div>
    </HydrationBoundary>
  );
}
