export const intervals = {
  "5m": "5 minutes",
  "15m": "15 minutes",
  "30m": "30 minutes",
  "1h": "1 hour",
  "1d": "1 day",
} as const;
export type Interval = keyof typeof intervals;
export type Status = "all" | "pending" | "ready" | "completed" | "cancelled";
export type Channel = "all" | "mobile" | "face";
export type SalesBasis = "completed" | "accepted" | "all";
export type CongestionMetric = "preparing" | "active" | "arrivals";
export interface Filters {
  start: string;
  end: string;
  interval: Interval;
  store: string;
  menu: string;
  status: Status;
  channel: Channel;
  sales: SalesBasis;
  congestionMetric: CongestionMetric;
  low: number;
  high: number;
}
export interface Metrics {
  orders: number;
  pending: number;
  ready: number;
  completed: number;
  cancelled: number;
  face: number;
  guests: number;
  revenue: number;
  units: number;
  salesOrders: number;
  cancellationRate: number | null;
  faceRate: number | null;
  averageAmount: number | null;
  averageMinutes: number | null;
  medianMinutes: number | null;
  p90Minutes: number | null;
  preparationMinutes: number | null;
  preparationMedianMinutes: number | null;
  preparationP90Minutes: number | null;
  preparationSamples: number;
  pickupMinutes: number | null;
  pickupMedianMinutes: number | null;
  pickupP90Minutes: number | null;
  pickupSamples: number;
  cancellationWaitMinutes: number | null;
}
export interface MetricRow extends Metrics {
  key: string;
  name: string;
}
export interface StoreTimeRow extends Metrics {
  key: string;
  storeId: string;
  name: string;
}
export interface CongestionRow {
  at: string;
  storeId: string;
  storeName: string;
  reported: number | null;
  inferred: number;
  preparing: number;
  active: number;
  arrivals: number;
  gap: number | null;
}
export interface Metadata {
  stores: { id: string; name: string }[];
  menus: { id: string; name: string; storeId: string }[];
  firstOrder: string | null;
  lastOrder: string | null;
  hasActivityLog: boolean;
}
export interface AnalyticsData {
  filters: Filters;
  generatedAt: string;
  summary: Metrics;
  timeline: MetricRow[];
  stores: MetricRow[];
  menus: MetricRow[];
  statuses: MetricRow[];
  channels: MetricRow[];
  hours: MetricRow[];
  weekdays: MetricRow[];
  storeTimeline: StoreTimeRow[];
  durations: { name: string; orders: number }[];
  congestion: CongestionRow[];
  hasActivityLog: boolean;
}
