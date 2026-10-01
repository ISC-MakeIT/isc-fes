import { describe, expect, it } from "vitest";
import { buildStoreUpdateInput } from "./build-store-update-input";

const initial = {
  room: "605教室" as const,
  description: "現在の説明",
  allergenIds: ["egg", "milk"],
};

describe("buildStoreUpdateInput", () => {
  it("keeps omitted fields out of the PATCH body", () => {
    expect(buildStoreUpdateInput(initial, { ...initial })).toEqual({});
    expect(
      buildStoreUpdateInput(initial, {
        ...initial,
        allergenIds: ["milk", "egg"],
      }),
    ).toEqual({});
  });

  it("sends only changed fields, including an empty allergen list", () => {
    expect(
      buildStoreUpdateInput(initial, {
        ...initial,
        room: "606教室",
        allergenIds: [],
      }),
    ).toEqual({ room: "606教室", allergenIds: [] });
  });
});
