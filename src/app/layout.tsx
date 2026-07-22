import type { Metadata, Viewport } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { StudioBackground } from "@/components/studio-background";
import { ServiceWorker } from "@/components/service-worker";
import { Toaster } from "@/components/ui/sonner";

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const statFont = JetBrains_Mono({
  variable: "--font-stat",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#14161a" },
  ],
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
    <html
      lang="en"
      className={`${bodyFont.variable} ${statFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground min-h-full overflow-x-hidden">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <StudioBackground />
          {children}
          <Toaster position="top-center" />
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
