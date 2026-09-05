import { HERO_IMAGE_ASPECT } from "@/shared/config";
import { AspectRatio } from "@/shared/ui/aspect-ratio";
import { FloorGuide } from "./floor-guide";

export function GuestHomeView() {
  return (
    <div className="space-y-8 md:flex md:flex-row">
      {/* TODO: キービジュアルができしだい配備 */}
      <AspectRatio ratio={HERO_IMAGE_ASPECT} className="bg-gray-300 md:w-140" />
      <div className="mx-auto">
        <FloorGuide />
      </div>
    </div>
  );
}
