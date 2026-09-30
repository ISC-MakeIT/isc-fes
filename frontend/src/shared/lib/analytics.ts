const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
export const analyticsScriptUrl = measurementId
  ? `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  : undefined;
const debugSend =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_GA_DEBUG_SEND === "true";

export const analyticsEnabled =
  Boolean(measurementId) &&
  (process.env.NEXT_PUBLIC_VERCEL_ENV === "production" || debugSend);

type AnalyticsValue = string | number | boolean | AnalyticsItem[];
type AnalyticsParams = Record<string, AnalyticsValue>;

export type AnalyticsItem = {
  item_id: string;
  item_name?: string;
  price?: number;
  affiliation?: string;
  index?: number;
};

export type AnalyticsEventName =
  | "select_floor"
  | "select_store"
  | "view_store"
  | "view_item_list"
  | "select_item"
  | "view_item"
  | "topping_selection_changed"
  | "login_started"
  | "store_application_submitted"
  | "store_profile_updated"
  | "store_invitation_created"
  | "store_invitation_copied"
  | "store_member_removed"
  | "menu_created"
  | "menu_updated"
  | "menu_deleted"
  | "topping_created"
  | "topping_updated"
  | "topping_deleted"
  | "item_availability_changed"
  | "store_application_reviewed";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const staticRoutes = new Set([
  "/",
  "/orders",
  "/login",
  "/member/stores",
  "/member/stores/register",
  "/admin/store-applications",
]);

export function analyticsPath(pathname: string): string {
  if (staticRoutes.has(pathname)) return pathname;
  if (/^\/stores\/[^/]+\/menus\/[^/]+$/.test(pathname)) {
    return "/stores/:storeId/menus/:menuId";
  }
  if (/^\/stores\/[^/]+$/.test(pathname)) return "/stores/:storeId";
  if (/^\/member\/stores\/[^/]+$/.test(pathname)) {
    return "/member/stores/:storeId";
  }
  if (
    /^\/member\/stores\/[^/]+\/(edit|menus|kitchen|pickup|call)$/.test(pathname)
  ) {
    return pathname.replace(
      /^\/member\/stores\/[^/]+\//,
      "/member/stores/:storeId/",
    );
  }
  return "/other";
}

export function analyticsArea(pathname: string): "guest" | "member" | "admin" {
  if (pathname.startsWith("/member/")) return "member";
  if (pathname.startsWith("/admin/")) return "admin";
  return "guest";
}

const allowedUtmKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
];
const safeCampaignValue = /^[a-zA-Z0-9_.-]{1,80}$/;

export function analyticsLocation(rawUrl: string): string {
  const url = new URL(rawUrl);
  const safe = new URL(analyticsPath(url.pathname), url.origin);
  for (const key of allowedUtmKeys) {
    const value = url.searchParams.get(key);
    if (value && safeCampaignValue.test(value))
      safe.searchParams.set(key, value);
  }
  return safe.toString();
}

export function analyticsReferrer(
  rawUrl: string,
  currentOrigin: string,
): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.origin === currentOrigin
      ? analyticsLocation(url.toString())
      : url.origin;
  } catch {
    return undefined;
  }
}

let initialized = false;
let lastPageLocation: string | undefined;

function initializeAnalytics() {
  if (!analyticsEnabled || !measurementId || typeof window === "undefined")
    return false;
  if (initialized) return true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function () {
    window.dataLayer?.push(arguments);
  };
  const location = analyticsLocation(window.location.href);
  window.gtag("js", new Date());
  window.gtag("set", {
    page_location: location,
    page_referrer:
      analyticsReferrer(document.referrer, window.location.origin) ?? "",
    page_title: "ふぇすNavi",
  });
  window.gtag("config", measurementId, {
    send_page_view: false,
    ...(debugSend ? { debug_mode: true } : {}),
  });

  initialized = true;
  return true;
}

export function trackPageView() {
  if (!initializeAnalytics()) return;
  const location = analyticsLocation(window.location.href);
  if (lastPageLocation === location) return;

  const referrer =
    lastPageLocation ??
    analyticsReferrer(document.referrer, window.location.origin);
  window.gtag?.("set", {
    page_location: location,
    page_referrer: referrer ?? "",
  });
  window.gtag?.("event", "page_view", {
    page_title: "ふぇすNavi",
    page_location: location,
    page_referrer: referrer ?? "",
    app_area: analyticsArea(window.location.pathname),
    ...(debugSend ? { debug_mode: true } : {}),
  });
  lastPageLocation = location;
}

export function trackEvent(
  name: AnalyticsEventName,
  params: AnalyticsParams = {},
) {
  if (!initializeAnalytics()) return;
  trackPageView();
  window.gtag?.(
    "event",
    name,
    analyticsEventPayload(params, window.location.href, debugSend),
  );
}

export function analyticsEventPayload(
  params: AnalyticsParams,
  rawUrl: string,
  debug = false,
) {
  const url = new URL(rawUrl);
  return {
    ...params,
    app_area: analyticsArea(url.pathname),
    page_location: analyticsLocation(rawUrl),
    ...(debug ? { debug_mode: true } : {}),
  };
}
