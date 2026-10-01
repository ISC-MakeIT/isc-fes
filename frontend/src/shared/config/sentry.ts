const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment =
  process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "prod" : "dev";

export const sentryOptions = {
  dsn,
  enabled: Boolean(dsn) && process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "false",
  environment,
  tracesSampleRate: Number(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ??
      (environment === "prod" ? "0.1" : "1"),
  ),
  strictTraceContinuation: true,
};
