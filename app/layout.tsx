import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clipper",
  description: "A simple installable cropper for quick image trimming on mobile.",
  applicationName: "Clipper",
  icons: {
    icon: "/clipper-app-icon-20260522.png",
    shortcut: "/clipper-app-icon-20260522.png",
    apple: "/clipper-app-icon-20260522.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Clipper",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#ede4d3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
