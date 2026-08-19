import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const ui = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

// Fraunces carries the wordmark only. next/font allows custom axes on a variable
// font only when the weight comes from the axis rather than a fixed list.
const brand = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Blue Hour — half marathon trainer",
  description:
    "Pick your race and Blue Hour builds the training, fueling, and strength weeks back from it.",
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://blue-hour-psi.vercel.app"),
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-icon",
  },
  openGraph: {
    title: "Blue Hour — half marathon trainer",
    description:
      "Pick your race and Blue Hour builds the training, fueling, and strength weeks back from it.",
    siteName: "Blue Hour",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    title: "Blue Hour",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f2f0ea",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${brand.variable}`}>
      <body>{children}</body>
    </html>
  );
}
