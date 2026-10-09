import { EventScheduleView } from "@/_pages/event-schedule";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "イベント",
};

export default function EventsPage() {
  return <EventScheduleView />;
}
