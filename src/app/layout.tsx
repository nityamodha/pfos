import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuroraBackground } from "@/components/aurora-background";
import { ServiceWorker } from "@/components/service-worker";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PFOS — Financial OS",
  description: "A dashboard for your financial life. Track net worth, not just expenses.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PFOS",
  },
};

export const viewport: Viewport = {
  themeColor: "#f1eefb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} dark h-full antialiased`}>
      <body className="bg-background text-foreground min-h-full overflow-x-hidden">
        <AuroraBackground />
        {children}
        <Toaster position="top-center" />
        <ServiceWorker />
      </body>
    </html>
  );
}
