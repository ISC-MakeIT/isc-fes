import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const isDev = process.env.NODE_ENV !== "production";
const sentryTracesSampleRate = Number(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ??
    (process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "0.1" : "1"),
);

if (
  process.env.VERCEL_ENV &&
  process.env.NEXT_PUBLIC_VERCEL_ENV !== process.env.VERCEL_ENV
) {
  throw new Error("NEXT_PUBLIC_VERCEL_ENV must match VERCEL_ENV");
}
if (
  process.env.NEXT_PUBLIC_SENTRY_ENABLED !== undefined &&
  process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "true" &&
  process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "false"
) {
  throw new Error("NEXT_PUBLIC_SENTRY_ENABLED must be true or false");
}
if (
  process.env.VERCEL_ENV === "production" &&
  !process.env.NEXT_PUBLIC_SENTRY_DSN
) {
  throw new Error("NEXT_PUBLIC_SENTRY_DSN is required for Vercel Production");
}
if (
  !Number.isFinite(sentryTracesSampleRate) ||
  sentryTracesSampleRate < 0 ||
  sentryTracesSampleRate > 1
) {
  throw new Error(
    "NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE must be a number between 0 and 1",
  );
}

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "4566",
        pathname: "/isc-fes-local/**",
      },
      {
        protocol: "https",
        hostname: "img.fes.iwasaki.ac.jp",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
    // 開発環境ではLocalの画像ストレージを使うため内部IPへの接続を許可してる
    dangerouslyAllowLocalIP: isDev,
  },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
