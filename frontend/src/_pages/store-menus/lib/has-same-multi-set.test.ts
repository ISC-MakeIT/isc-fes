import { describe, expect, test } from "vitest";
import { hasSameMultiSet } from "./has-same-multi-set";

describe("hasSameMultiSet", () => {
  test("同じ値が同じ回数含まれていればtrueを返す", () => {
    expect(
      hasSameMultiSet({
        initialValues: [1, 1, 2],
        currentValues: [2, 1, 1],
      }),
    );
  });

  test("配列の長さが同じでも値の出現回数が異なればfalseを返す", () => {
    expect(
      hasSameMultiSet({
        initialValues: [1, 1],
        currentValues: [2, 1],
      }),
    );
  });

  test("同じ値でも出現回数が異なればfalseを返す", () => {
    expect(
      hasSameMultiSet({
        initialValues: [1, 1],
        currentValues: [1],
      }),
    );
  });

  test("両方が空配列ならtrueを返す", () => {
    expect(
      hasSameMultiSet({
        initialValues: [],
        currentValues: [],
      }),
    );
  });
});
