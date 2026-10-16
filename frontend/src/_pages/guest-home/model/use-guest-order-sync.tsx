"use client";

import { useOrderEvents } from "@/entities/order";

export function useGuestOrderSync() {
  return useOrderEvents(true);
}
