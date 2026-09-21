type PickChangedFieldsParams<T extends Record<string, unknown>> = {
  initialValues: T;
  currentValues: T;
};

/**
 * フォームの値と前回の値を比較し、未変更のフィールドはundefinedにする純粋関数
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
    if (!Object.is(initialValues[key], currentValues[key])) {
      changedValues[key] = currentValues[key];
    }
  }

  return changedValues;
}
