import { hasSameMultiSet } from "./has-same-multi-set";

type PickChangedFieldsParams<T extends Record<string, unknown>> = {
  initialValues: T;
  currentValues: T;
};

/**
 * フォームの値と前回の値を比較し、変更されたフィールドだけを返す純粋関数
 * @param initialValues
 * @param currentValues
 * @returns
 */
export function pickChangedFields<T extends Record<string, unknown>>({
  initialValues,
  currentValues,
}: PickChangedFieldsParams<T>): Partial<T> {
  const changedValues: Partial<T> = {};

  // Object.keysはstring[]を返すので、Tに含まれるキーだけにするようキャスト
  for (const key of Object.keys(currentValues) as Array<keyof T>) {
    const initialValue = initialValues[key];
    const currentValue = currentValues[key];

    const isArray = Array.isArray(initialValue) && Array.isArray(currentValue);

    const hasChanged = isArray
      ? !hasSameMultiSet({
          initialValues: initialValue,
          currentValues: currentValue,
        })
      : !Object.is(initialValue, currentValue);

    if (hasChanged) {
      changedValues[key] = currentValue;
    }
  }

  return changedValues;
}
