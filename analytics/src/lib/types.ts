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
  medianAmount: number | null;
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
  cancellationWaitMedianMinutes: number | null;
  cancellationMinutes: number | null;
  cancellationMedianMinutes: number | null;
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
  firstGuest: string | null;
  lastGuest: string | null;
  firstReview: string | null;
  lastReview: string | null;
  reviewTriggers: string[];
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
  menuTimeline: (Metrics & { key: string; menuId: string; name: string })[];
  durations: { name: string; orders: number }[];
  congestion: CongestionRow[];
  hasActivityLog: boolean;
}

export interface StoreFilters extends Filters {
  storeIds: string[];
  accumulation: "interval" | "cumulative";
}
export interface OverviewFilters {
  start: string;
  end: string;
  interval: Interval;
  sales: SalesBasis;
}
export interface OverviewMetrics {
  revenue: number;
  orders: number;
  salesOrders: number;
  completed: number;
  cancelled: number;
  face: number;
  cancellationRate: number | null;
  faceRate: number | null;
}
export interface OverviewPoint extends OverviewMetrics {
  key: string;
  name: string;
  bucketStart: string;
}
export interface OverviewData {
  filters: OverviewFilters;
  generatedAt: string;
  summary: OverviewMetrics;
  timeline: OverviewPoint[];
}
export interface GuestFilters {
  start: string;
  end: string;
  interval: Interval;
  channel: Channel;
  cohort: "purchasers" | "registered";
  cumulative: "total" | "period";
  stay: "closed" | "observed";
}
export interface GuestSummary {
  registered: number;
  totalRegistered: number;
  population: number;
  buyers: number;
  revenue: number;
  averageSpend: number | null;
  medianSpend: number | null;
  averageOrders: number | null;
  averageStores: number | null;
  averageStayMinutes: number | null;
  medianStayMinutes: number | null;
  staySamples: number;
  observationDays: number;
  singleObservationDays: number;
  openDays: number;
}
export interface GuestDaily {
  key: string;
  name: string;
  registered: number;
  buyers: number;
  population: number;
  averageSpend: number | null;
  medianSpend: number | null;
  averageStayMinutes: number | null;
  medianStayMinutes: number | null;
  staySamples: number;
  singleObservationDays: number;
  openDays: number;
}
export interface GuestData {
  filters: GuestFilters;
  generatedAt: string;
  hasActivityLog: boolean;
  summary: GuestSummary;
  registrations: {
    key: string;
    name: string;
    registered: number | null;
    cumulativeTotal: number | null;
    cumulativePeriod: number | null;
  }[];
  daily: GuestDaily[];
  spendingDistribution: { name: string; guests: number }[];
  stayDistribution: { name: string; days: number }[];
}
export interface ChartPoint {
  key: string;
  label: string;
  seriesId: string;
  series: string;
  value: number | null;
  samples: number | null;
}

export type ReviewAudience = "guest" | "store" | "unknown";
export interface ReviewFilters {
  start: string;
  end: string;
  interval: Interval;
  audience: "all" | ReviewAudience;
  trigger: string;
  missingTrigger: boolean;
  ratingMin: number;
  ratingMax: number;
  comment: "all" | "with" | "without";
  search: string;
  page: number;
}
export interface ReviewStats {
  count: number;
  averageRating: number | null;
  medianRating: number | null;
  commentCount: number;
  commentRate: number | null;
  highRate: number | null;
  lowRate: number | null;
}
export interface ReviewGroup extends ReviewStats {
  key: ReviewAudience;
  name: string;
}
export interface ReviewRating {
  rating: number;
  count: number;
  share: number | null;
}
export interface ReviewComment {
  key: string;
  createdAt: string;
  createdLabel: string;
  audience: ReviewAudience;
  trigger: string | null;
  rating: number;
  comment: string | null;
}
export interface ReviewData {
  filters: ReviewFilters;
  generatedAt: string;
  summary: ReviewStats;
  audiences: ReviewGroup[];
  triggers: (ReviewStats & { trigger: string | null; audience: ReviewAudience })[];
  ratings: ReviewRating[];
  audienceRatings: (ReviewRating & { audience: ReviewAudience })[];
  timeline: (ReviewStats & { key: string; name: string; audience: ReviewAudience })[];
  reviews: ReviewComment[];
  page: number;
  pageSize: number;
}
