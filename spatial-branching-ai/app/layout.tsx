import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@xyflow/react/dist/style.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://numitree.com'),
  title: {
    default: 'Numi',
    template: '%s | Numi',
  },
  description: 'An infinite-canvas spatial AI workspace for brainstorming and collaboration.',
  openGraph: {
    title: 'Numi',
    description: 'An infinite-canvas spatial AI workspace.',
    url: 'https://numitree.com',
    siteName: 'Numi',
    locale: 'en_US',
    type: 'website',
  },
  keywords: ["AI", "conversations", "branching", "canvas", "LLM", "ChatGPT"],
  icons: {
    icon: "/icon.png",
  },
};

import { ThemeProvider } from "@/components/providers/theme-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
