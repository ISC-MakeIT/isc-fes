import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "4566",
        pathname: "/isc-fes-local/stores/**",
      },
      {
        protocol: "https",
        hostname: "img.fes.iwasaki.ac.jp",
      },
    ],
    // 開発環境ではLocalの画像ストレージを使うため内部IPへの接続を許可してる
    dangerouslyAllowLocalIP: isDev,
  },
};

export default nextConfig;
