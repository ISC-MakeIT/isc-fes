import { describe, expect, test } from "vitest";
import { buildFormDataBody } from "./build-form-data-body";

describe("buildFormdataBody", () => {
  test("undefinedのフィールドはFormDataに含めない", () => {
    const fd = buildFormDataBody({ name: "店名", image: undefined });
    expect(fd.has("image")).toBe(false);
    expect(fd.get("name")).toBe("店名");
  });
});
