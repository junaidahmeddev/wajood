import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "WAJOOD — Pakistan's Unified Missing Persons Platform",
  description:
    "WAJOOD connects families, law enforcement, NGOs, and communities across Pakistan to find missing persons through AI-powered matching, multi-portal coordination, and real-time notifications.",
  keywords: [
    "missing persons",
    "Pakistan",
    "WAJOOD",
    "find missing",
    "person search",
    "law enforcement",
    "NGO",
  ],
};

import Providers from "@/components/providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

