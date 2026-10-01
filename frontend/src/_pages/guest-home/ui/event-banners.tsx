import { currentScheduledEvents } from "@/entities/event";
import { EVENT_IMAGE_ASPECT, eventsUrl } from "@/shared/config";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import { Mask } from "@/shared/ui/mask";
import Link from "next/link";

export function EventBanners() {
  return (
    <div className="flex flex-row gap-6 overflow-x-auto px-4 py-4">
      {currentScheduledEvents.map((event) => (
        <Link key={event.name} href={eventsUrl()}>
          <AspectRatioImage
            ratio={EVENT_IMAGE_ASPECT}
            alt={`${event.name}のバナー画像`}
            src={event.bannerPath}
            className="w-84"
          />
        </Link>
      ))}
    </div>
  );
}
