export const integer = (value: number) =>
  new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(value);
export const yen = (value: number) => `¥${integer(value)}`;
export const decimal = (value: number | null, digits = 1) =>
  value == null
    ? "—"
    : value.toLocaleString("ja-JP", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
export const percent = (value: number | null) => (value == null ? "—" : `${decimal(value)}%`);
export const minutes = (value: number | null) => (value == null ? "—" : `${decimal(value)}分`);
export const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
export const statusNames: Record<string, string> = {
  pending: "調理中",
  ready: "受取待ち",
  completed: "受取完了",
  cancelled: "キャンセル",
};
