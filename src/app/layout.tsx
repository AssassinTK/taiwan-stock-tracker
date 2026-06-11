import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "台股戰情室",
  description: "即時台股追蹤 × 世界大事影響分析",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="antialiased min-h-screen bg-[#0f1117]">
        {children}
      </body>
    </html>
  );
}
