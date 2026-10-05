import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "./query-provider";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { AnalyticsPageView } from "./analytics-page-view";
import { DotGothic16, Geist, Geist_Mono } from "next/font/google";

export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dotGothic16 = DotGothic16({
  variable: "--font-dot-gothic",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ふぇすNavi",
  description:
    "情報科学専門学校の学園祭で店舗やメニューを探し、商品を注文できるアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} ${dotGothic16.variable} h-full antialiased`}
    >
      <QueryProvider>
        <body className="flex min-h-full flex-col">
          <NuqsAdapter>
            <AnalyticsPageView />
            {children}
          </NuqsAdapter>
        </body>
      </QueryProvider>
    </html>
  );
}
