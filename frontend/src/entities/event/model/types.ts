import { StaticImageData } from "next/image";

export type ScheduledEvent = {
  name: string;
  bannerPath: StaticImageData | undefined;
  description: string;
  startAt: Date;
  endAt: Date;
};
