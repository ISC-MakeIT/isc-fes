import type { components } from "@/shared/api";
import type { StoreEditFormValues } from "../model/types";

type StoreDetails = Pick<
  StoreEditFormValues,
  "room" | "description" | "allergenIds"
>;

export function buildStoreUpdateInput(
  initial: StoreDetails,
  current: StoreDetails,
): components["schemas"]["UpdateStoreInput"] {
  const input: components["schemas"]["UpdateStoreInput"] = {};

  if (current.room !== initial.room) input.room = current.room;
  if (current.description !== initial.description) {
    input.description = current.description;
  }
  if (
    current.allergenIds.length !== initial.allergenIds.length ||
    current.allergenIds.some((id) => !initial.allergenIds.includes(id))
  ) {
    input.allergenIds = current.allergenIds;
  }

  return input;
}
