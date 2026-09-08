import { Room } from "@/entities/room";
import { Store, StoreReviewStatus } from "@/entities/store";
import { describe, expect, test } from "vitest";
import { selectApprovedStoresByFloor } from "./select-approved-stores-by-floor";

describe("selectFloorGuideStores", () => {
  test("承認済みの店舗のみ表示されること", () => {
    const approvedStore = createStore("1F", StoreReviewStatus.Approved);
    const rejectedStore = createStore("1F", StoreReviewStatus.Rejected);
    const pendingStore = createStore("1F", StoreReviewStatus.Pending);
    const stores: Store[] = [approvedStore, rejectedStore, pendingStore];

    const result = selectApprovedStoresByFloor(stores, 1);

    expect(result).toEqual([approvedStore]);
  });
});

function createStore(room: Room, reviewStatus: StoreReviewStatus) {
  const store: Store = {
    id: "test",
    name: "test",
    imageUrl: "test",
    description: "test",
    room: room,
    reviewStatus: reviewStatus,
    allergens: [],
  };

  return store;
}
