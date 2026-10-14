import { useState } from "react";

/**
 * 同時に開ける数を制限。上限を超えたら古いものから閉じる
 * @param itemIds
 * @param limit
 * @returns
 */
export function useLimitedOpenItems(itemIds: string[], limit: number) {
  const [openIds, setOpenIds] = useState(() => itemIds.slice(0, limit));

  const value = openIds.filter((id) => itemIds.includes(id));

  function onValueChange(nextIds: string[]) {
    setOpenIds(nextIds.slice(-limit));
  }

  return [value, onValueChange] as const;
}
