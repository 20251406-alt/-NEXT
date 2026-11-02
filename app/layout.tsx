import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./logo.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "급식 NEXT",
  description: "오늘의 데이터를, 내일의 지속가능한 급식으로.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/brand/geupsik-next-icon.png",
    shortcut: "/brand/geupsik-next-icon.png",
    apple: "/brand/geupsik-next-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
