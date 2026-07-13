import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { SidebarNav } from "@/components/sidebar-nav";
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
        <div className="relative z-10 flex min-h-dvh w-full">
          <SidebarNav />
          <div className="flex w-full flex-1 flex-col md:pl-64">
            <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] md:max-w-5xl md:px-10 md:pb-16 md:pt-10 lg:max-w-6xl xl:max-w-7xl">
              {children}
            </main>
            <BottomNav />
          </div>
        </div>
        <Toaster position="top-center" />
        <ServiceWorker />
      </body>
    </html>
  );
}
