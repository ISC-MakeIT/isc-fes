type HasSameMultiSetParams<T> = {
  initialValues: T[];
  currentValues: T[];
};

/**
 * 配列同士を順序は無視して同じ値を同じ個数持ってるかを判定する純粋関数
 * @param param0
 * @returns
 */
export function hasSameMultiSet<T>({
  initialValues,
  currentValues,
}: HasSameMultiSetParams<T>) {
  if (initialValues.length !== currentValues.length) {
    return false;
  }

  const sortedInitialValues = [...initialValues].sort();
  const sortedCurrentValues = [...currentValues].sort();

  return sortedInitialValues.every(
    (value, index) => value === sortedCurrentValues[index],
  );
}
