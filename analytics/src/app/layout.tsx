import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ISC FES Analytics | 学園祭 2026",
  description: "学園祭の注文・売上・混雑度を振り返るローカル分析ワークスペース",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
