import type { Metadata } from "next";
import { DM_Serif_Display, DM_Sans, DM_Mono } from "next/font/google";
import Link from "next/link";
import PWAProvider from "@/src/components/PWAProvider";
import ActAsBanner from "@/src/components/ActAsBanner";
import SplashGate from "@/src/components/SplashGate";
import "./globals.css";

// Sure Step Education company aesthetic — three-voice type (canonical default):
// display serif (DM Serif Display), body sans (DM Sans), mono eyebrows (DM Mono).
// See Sure_Step_Education_Aesthetic.md.
const display = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--ssd-font-display",
});

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--ssd-font-body",
});

const mono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--ssd-font-mono",
});

export const metadata: Metadata = {
  title: "DailyWins",
  description: "Classroom behavior tracking for school districts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#252a4a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DailyWins" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} antialiased`}
      >
        <PWAProvider>
          <ActAsBanner />
          <SplashGate>
            {children}
            <footer className="w-full py-4 text-center text-xs text-gray-400">
              <Link href="/privacy" className="hover:text-gray-600 transition-colors">
                Privacy Policy
              </Link>
            </footer>
          </SplashGate>
        </PWAProvider>
      </body>
    </html>
  );
}
