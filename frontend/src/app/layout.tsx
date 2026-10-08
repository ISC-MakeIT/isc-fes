import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "./query-provider";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { AnalyticsPageView } from "./analytics-page-view";
import { AppQuestionnaireProvider } from "@/widgets/app-questionnaire";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ふぇすナビ",
    template: "%s - ふぇすナビ",
  },
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <QueryProvider>
        <AppQuestionnaireProvider>
          <body className="flex min-h-full flex-col">
            <NuqsAdapter>
              <AnalyticsPageView />
              {children}
            </NuqsAdapter>
          </body>
        </AppQuestionnaireProvider>
      </QueryProvider>
    </html>
  );
}
