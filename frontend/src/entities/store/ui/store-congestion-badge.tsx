import { StoreCongestionLevel } from "../model/types";
import Image, { StaticImageData } from "next/image";
import congestionLevel1Icon from "./assets/congestion-level-1.svg";
import congestionLevel2Icon from "./assets/congestion-level-2.svg";
import congestionLevel3Icon from "./assets/congestion-level-3.svg";
import { cn } from "@/shared/lib/utils";

const congestionIcon = {
  "1": {
    alt: "混雑状況：空いています",
    icon: congestionLevel1Icon,
  },
  "2": {
    alt: "混雑状況：やや混雑しています",
    icon: congestionLevel2Icon,
  },
  "3": {
    alt: "混雑状況：混雑しています",
    icon: congestionLevel3Icon,
  },
} as const satisfies Record<
  StoreCongestionLevel,
  {
    alt: string;
    icon: StaticImageData;
  }
>;

type StoreCongestionBadgeProps = {
  congestionLevel: StoreCongestionLevel;
  className?: string;
};

export function StoreCongestionBadge({
  congestionLevel,
  className,
}: StoreCongestionBadgeProps) {
  const congestion = congestionIcon[congestionLevel];

  return (
    <Image
      src={congestion.icon}
      alt={congestion.alt}
      className={cn("shrink-0", className)}
      draggable={false}
    />
  );
}
