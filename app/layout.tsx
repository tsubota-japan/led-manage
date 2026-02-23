import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LED Display Manager",
  description: "LED display content management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
