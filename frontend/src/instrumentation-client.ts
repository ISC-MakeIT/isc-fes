import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./shared/config/sentry";

Sentry.init({
  ...sentryOptions,
  tracePropagationTargets: [
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
