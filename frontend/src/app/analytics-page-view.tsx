"use client";

import {
  analyticsEnabled,
  analyticsScriptUrl,
  trackPageView,
} from "@/shared/lib/analytics";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useState } from "react";

export function AnalyticsPageView() {
  const pathname = usePathname();
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!analyticsEnabled || !analyticsScriptUrl) return;
    trackPageView();
    setScriptReady(true);
  }, [pathname]);

  return scriptReady && analyticsScriptUrl ? (
    <Script id="ga4" src={analyticsScriptUrl} strategy="afterInteractive" />
  ) : null;
}
