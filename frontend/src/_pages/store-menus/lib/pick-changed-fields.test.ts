import { describe, expect, test } from "vitest";
import { pickChangedFields } from "./pick-changed-fields";

describe("pickChangedFields", () => {
  const initialValues = {
    name: "パンケーキ",
    unitPrice: 100,
    soldOut: false,
  };

  test("変更がない場合は空のオブジェクトを返す", () => {
    const currentValues = { ...initialValues };

    const result = pickChangedFields({ initialValues, currentValues });

    expect(result).toEqual({});
  });

  test("名前だけ変更された場合はnameだけを返す", () => {
    const currentValues = { ...initialValues, name: "ベビーカステラ" };

    const result = pickChangedFields({ initialValues, currentValues });

    expect(result).toEqual({
      name: "ベビーカステラ",
    });
  });

  test("完売状態だけ変更された場合はsoldOutだけを返す", () => {
    const currentValues = { ...initialValues, soldOut: true };

    const result = pickChangedFields({ initialValues, currentValues });

    expect(result).toEqual({
      soldOut: true,
    });
  });

  test("initialValuesに含まれてないキーも返す", () => {
    const currentValues = { ...initialValues, hoge: "hoge" };

    const result = pickChangedFields({ initialValues, currentValues });

    expect(result).toEqual({
      hoge: "hoge",
    });
  });
});
