import { events2026 } from "@/entities/event/config/events";
import { EVENT_IMAGE_ASPECT } from "@/shared/config";
import { AspectRatioImage } from "@/shared/ui/aspect-ratio-image";
import Link from "next/link";

export function EventBanners() {
  return (
    <div className="flex flex-row gap-6 overflow-x-auto px-4 py-4">
      {events2026.map((event) => (
        <Link key={event.name} href="">
          <AspectRatioImage
            ratio={EVENT_IMAGE_ASPECT}
            alt={`${event.name}のバナー画像`}
            src={event.bannerPath}
            className="w-[12.4444rem]"
          />
        </Link>
      ))}
    </div>
  );
}
