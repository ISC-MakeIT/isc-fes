import { Room } from "@/entities/room";
import { Store, StoreReviewStatus } from "@/entities/store";
import { describe, expect, test } from "vitest";
import { selectApprovedStoresByFloor } from "./select-approved-stores-by-floor";

describe("selectApprovedStoresByFloor", () => {
  test("指定した階かつ承認済み店舗のみを返す", () => {
    const approvedStoresOnFifthFloor = [
      createStore("501", StoreReviewStatus.Approved),
      createStore("506", StoreReviewStatus.Approved),
    ];

    const excludedStores = [
      // 同じ階だが未承認
      createStore("1F", StoreReviewStatus.Rejected),
      createStore("1F", StoreReviewStatus.Pending),
      // 承認済みだが別の階
      createStore("iCrossArena", StoreReviewStatus.Approved),
      createStore("1F", StoreReviewStatus.Approved),
      createStore("707", StoreReviewStatus.Approved),
    ];
    const stores: Store[] = [...approvedStoresOnFifthFloor, ...excludedStores];

    const result = selectApprovedStoresByFloor(stores, 5);

    expect(result).toEqual(approvedStoresOnFifthFloor);
  });

  test("店舗が存在しない場合は空配列を返す", () => {
    const result = selectApprovedStoresByFloor([], 5);

    expect(result).toEqual([]);
  });

  test("7階の店舗として707とiCrossArenaを返す", () => {
    const seventhFloorStores = [
      createStore("707", StoreReviewStatus.Approved),
      createStore("iCrossArena", StoreReviewStatus.Approved),
    ];

    const result = selectApprovedStoresByFloor(seventhFloorStores, 7);

    expect(result).toEqual(seventhFloorStores);
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
