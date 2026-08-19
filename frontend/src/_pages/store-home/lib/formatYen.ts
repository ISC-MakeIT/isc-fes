export function formatYen(amount: number): string {
  return `￥${amount.toLocaleString("ja-JP")}`;
}
